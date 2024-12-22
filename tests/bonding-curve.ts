import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { expect } from "chai";
import { BN } from "bn.js";
import keys from "../keys/users.json";
import key2 from "../keys/user2.json";
import {
  ASSOCIATED_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@coral-xyz/anchor/dist/cjs/utils/token";
import { ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BondingCurve, IDL } from "../target/types/bonding_curve";
import { getAuthAddress, getPoolAddress, getPoolLpMintAddress, getPoolVaultAddress, getOrcleAccountAddress } from "./utils";
import { createPoolFeeReceive, cpSwapProgram, configAddress } from "./utils/config";

const connection = new Connection(
  "https://devnet.helius-rpc.com/?api-key=d5206d28-8772-4058-bca3-b6194c2133f3",
  "confirmed"
);
// const connection = new Connection("http://localhost:8899", "confirmed")
const curveSeed = "CurveConfiguration";
const POOL_SEED_PREFIX = "liquidity_pool";

describe("bonding_curve", () => {
  const PROGRAM_ID = new anchor.web3.PublicKey(
    "43zsC4m9jKa1AZJuVpNLxpWFFNqopRHspv9F4Wko7Wsr"
  );
  const transactions = [];
  const program = new Program<BondingCurve>(
    IDL,
    PROGRAM_ID,
    anchor.AnchorProvider.env()
  ) as Program<BondingCurve>;

  const user = Keypair.fromSecretKey(new Uint8Array(keys)); // owner
  const user2 = Keypair.fromSecretKey(new Uint8Array(key2)); // user create token
  const user3 = Keypair.generate(); // user buy/sell token

  const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
  );


  let mint1: PublicKey;
  let tokenAta1: PublicKey;

  let mint2: PublicKey = new PublicKey(
    "HZsBgcpDRA6G2X7suKVhmddZMfmrS3ZscXjJNhEoC9qy"
  );

  console.log("Admin's wallet address is : ", user.publicKey.toBase58());

  it("Airdrop to admin wallet", async () => {
    console.log(
      `Requesting airdrop to admin for 1SOL : ${user.publicKey.toBase58()}`
    );
    // 1 - Request Airdrop
    await connection.requestAirdrop(user.publicKey, 10 ** 9);
  });

  it("Airdrop to user wallet", async () => {
    // transfer token 2 to user2
    // Tạo token account cho user2 nếu chưa có
    const user2TokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      user2, // Payer for creating account
      mint2, // Token mint
      user2.publicKey // Owner of token account
    );

    // Transfer 1000 token mint2 cho user2
    await mintTo(
      connection,
      user2, // Payer
      mint2, // Token mint
      user2TokenAccount.address, // Destination
      user2.publicKey, // Mint authority
      1000 * 10 ** 9 // Amount (với 9 decimals)
    );
    // 1 - Request Airdrop
    await connection.requestAirdrop(user2.publicKey, 10 ** 9);
  });

  it("Airdrop to user3 wallet", async () => {
    // transfer token 2 to user2
    // Tạo token account cho user2 nếu chưa có
    const user3TokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      user2, // Payer for creating account
      mint2, // Token mint
      user3.publicKey // Owner of token account
    );

    // Transfer 1000 token mint2 cho user2
    await mintTo(
      connection,
      user2, // Payer
      mint2, // Token mint
      user3TokenAccount.address, // Destination
      user2.publicKey, // Mint authority
      1000 * 10 ** 9 // Amount (với 9 decimals)
    );
    // 1 - Request Airdrop
    await connection.requestAirdrop(user3.publicKey, 10 ** 9);
  });

  it("Initialize the contract", async () => {
    try {
      const [curveConfig] = PublicKey.findProgramAddressSync(
        [Buffer.from(curveSeed)],
        program.programId
      );
      const feeTokenCollector = await getOrCreateAssociatedTokenAccount(
        connection,
        user,
        mint2,
        user.publicKey
      );
      const tx = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 20_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1200_000 }),
        await program.methods
          .initialize(
            new BN(100), // fee percentage
            new BN(0.1 * 10 ** 9), // creation fees
            1280, // proportion
            feeTokenCollector.address, // fee collector
            user.publicKey, // fee sol collector
            new BN(1_000_000_000) // initial token for pool
          )
          .accounts({
            dexConfigurationAccount: curveConfig,
            admin: user.publicKey,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId,
          })
          .instruction()
      );
      tx.feePayer = user.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      console.log(await connection.simulateTransaction(tx));
      const sig = await sendAndConfirmTransaction(connection, tx, [user], {
        skipPreflight: true,
      });
      console.log(
        "Successfully initialized : ",
        `https://solscan.io/tx/${sig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`
      );
      transactions.push(`https://explorer.solana.com/tx/${sig}?cluster=devnet`);
      let pool = await program.account.curveConfiguration.fetch(curveConfig);
      console.log("Pool State : ", pool);
    } catch (error) {
      console.log("Error in initialization :", error);
    }
  });

  it("Update configuration", async () => {
    try {
      const [curveConfig] = PublicKey.findProgramAddressSync(
        [Buffer.from(curveSeed)],
        program.programId
      );
      const feeTokenCollector = await getOrCreateAssociatedTokenAccount(
        connection,
        user,
        mint2,
        user.publicKey
      );
      const tx = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 20_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1200_000 }),
        await program.methods
          .updateConfiguration(
            new BN(0), // fee percentage
            new BN(0.02 * 10 ** 9), // creation fees
            1280, // proportion
            feeTokenCollector.address, // fee collector
            user.publicKey, // fee sol collector
            new BN(1_000_000_100) // initial token for pool
          )
          .accounts({
            dexConfigurationAccount: curveConfig,
            admin: user.publicKey,
          })
          .instruction()
      );
      tx.feePayer = user.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      console.log(await connection.simulateTransaction(tx));
      const sig = await sendAndConfirmTransaction(connection, tx, [user], {
        skipPreflight: true,
      });
      console.log(
        "Successfully updated initialized : ",
        `https://solscan.io/tx/${sig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`
      );
      transactions.push(`https://explorer.solana.com/tx/${sig}?cluster=devnet`);
      let pool = await program.account.curveConfiguration.fetch(curveConfig);
      console.log("Pool State : ", pool);
    } catch (error) {
      console.log("Error in initialization :", error);
    }
  });

  it("Should create a new token", async () => {
    try {
      // Create Token With API
      const data = {
        creator: user2.publicKey.toBase58(),
        name: "Test Token 121324234234234322",
        description: "Test Token 121324234234234322",
        ticker: "TEST",
        image: "https://via.placeholder.com/150",
        website: "https://www.google.com",
      };
      const bearerToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3NWQxN2JmZTU3MGNlMzk4Y2U1OTRmNiIsIndhbGxldCI6IjJEYW9wUzNCb3dNN2tqbmVVR0hrTlVua3A5NmE3WnoxU0F1NlVXaUp3WlhuIiwibm9uY2UiOiI3NjA2MDYxNzA5MTE2OTEiLCJpYXQiOjE3MzQxNTQxNzUsImV4cCI6MTczNDI0MDU3NX0.RIYfRl603ahQ1XDYD8f39o8f2rV_CI32xpmpf8TRVfY";
      const response = await fetch("http://192.168.0.3:3000/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearerToken}`,
        },
        body: JSON.stringify(data),
      });
      const responseData: any = await response.json();
      console.log("Response from API:", responseData);
      // Find PDA for mint
      const [mintPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("mint"),
          user2.publicKey.toBuffer(),
          Buffer.from(responseData.data._id), // thêm off_chain_id vào seeds
        ],
        program.programId
      );

      // Get associated token account
      const userTokenPda = await getAssociatedTokenAddress(
        mintPda,
        user2.publicKey
      );

      // UPDATE 2024-12-07:
      // Find PDA for metadata account
      const [metadataAccount] = await PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mintPda.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      const [mintAuthorityPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("mint_authority"), mintPda.toBuffer()],
        program.programId
      );

      const [curveConfig] = PublicKey.findProgramAddressSync(
        [Buffer.from(curveSeed)],
        program.programId
      );

      // Create token with instruction
      const tx = await program.methods
        .createToken(
          "Test Token 121324234234234322",
          "TEST",
          responseData.data._id,
          "https://www.google.com",
        )
        .accounts({
          mint: mintPda,
          user: user2.publicKey,
          userTokenAccount: userTokenPda,
          metadataAccount,
          mintAuthority: mintAuthorityPda,
          dexConfigurationAccount: curveConfig,
          feeSolCollector: user.publicKey,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([user2])
        .rpc();

      // Wait for confirmation
      await connection.confirmTransaction(tx);
      console.log("Transaction signature:", tx);

      // Store addresses for later use
      mint1 = mintPda;
      tokenAta1 = userTokenPda;

      // Log addresses
      console.log("Mint address:", mint1.toBase58());
      console.log("Token account:", tokenAta1.toBase58());

      // Verify token account exists and has correct balance
      const tokenBalance = await connection.getTokenAccountBalance(tokenAta1);
      console.log("Token balance:", tokenBalance.value.uiAmount);

      // Assertions
      expect(tokenBalance.value.uiAmount).to.equal(1000000000);
      expect(tokenBalance.value.decimals).to.equal(9); // 9 decimals
    } catch (error) {
      console.error("Failed to create token:", error);
      throw error;
    }
  });

  // it("Mint token 2 to user wallet", async () => {
  //   console.log("Trying to create and mint token 2 to user's wallet");
  //   try {
  //     mint2 = await createMint(
  //       connection,
  //       user,
  //       user.publicKey,
  //       user.publicKey,
  //       tokenDecimal
  //     );
  //     console.log("mint 2 address: ", mint2.toBase58());

  //     tokenAta2 = (
  //       await getOrCreateAssociatedTokenAccount(
  //         connection,
  //         user,
  //         mint2,
  //         user.publicKey
  //       )
  //     ).address;
  //     console.log("token 2 account address: ", tokenAta2.toBase58());

  //     await mintTo(
  //       connection,
  //       user,
  //       mint2,
  //       tokenAta2,
  //       user.publicKey,
  //       BigInt(amount.toString())
  //     );
  //     const tokenBalance = await connection.getTokenAccountBalance(tokenAta2);
  //     console.log("token 2 Balance in user:", tokenBalance.value.uiAmount);
  //     console.log("token 2 successfully minted");
  //   } catch (error) {
  //     console.log("Token 2 creation error \n", error);
  //   }
  // });

  it("create pool", async () => {
    try {
      // Find pool PDA with both token mints
      const [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(POOL_SEED_PREFIX), mint1.toBuffer(), mint2.toBuffer()],
        program.programId
      );

      // Get associated token accounts for pool
      const poolTokenAccount = await getAssociatedTokenAddress(
        mint1,
        poolPda,
        true
      );

      const poolExchangeTokenAccount = await getAssociatedTokenAddress(
        mint2,
        poolPda,
        true
      );

      // Create transaction
      const tx = await program.methods
        .createPool()
        .accounts({
          pool: poolPda,
          tokenMint: mint1,
          exchangeTokenMint: mint2,
          poolTokenAccount: poolTokenAccount,
          poolExchangeTokenAccount: poolExchangeTokenAccount,
          payer: user2.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      // Add compute budget instructions
      const finalTx = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
        tx
      );

      finalTx.feePayer = user2.publicKey;
      finalTx.recentBlockhash = (
        await connection.getLatestBlockhash()
      ).blockhash;

      // Send and confirm transaction
      const sig = await sendAndConfirmTransaction(
        connection,
        finalTx,
        [user2],
        {
          skipPreflight: true,
        }
      );
      //log balance token 1 và 2  của user và pool
      const balance1 = await connection.getTokenAccountBalance(
        poolTokenAccount
      );
      const balance2 = await connection.getTokenAccountBalance(
        poolExchangeTokenAccount
      );
      console.log("Balance token 1 : ", balance1.value.uiAmount);
      console.log("Balance token 2 : ", balance2.value.uiAmount);

      console.log(
        "Successfully created pool:",
        `https://solscan.io/tx/${sig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`
      );
    } catch (error) {
      console.log("Error in creating pool:", error);
    }
  });

  it("Add liquidity", async () => {
    try {
      // Find pool PDA with both token mints
      const [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(POOL_SEED_PREFIX), mint1.toBuffer(), mint2.toBuffer()],
        program.programId
      );

      const [curveConfig] = PublicKey.findProgramAddressSync(
        [Buffer.from(curveSeed)],
        program.programId
      );

      // Get pool token accounts
      const poolTokenAccount = await getAssociatedTokenAddress(
        mint1,
        poolPda,
        true
      );

      const poolExchangeTokenAccount = await getAssociatedTokenAddress(
        mint2,
        poolPda,
        true
      );

      // Get user token accounts
      const userTokenAccount = await getAssociatedTokenAddress(
        mint1,
        user2.publicKey
      );

      const userExchangeTokenAccount = await getAssociatedTokenAddress(
        mint2,
        user2.publicKey
      );

      const tx = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
        await program.methods
          .addLiquidity()
          .accounts({
            pool: poolPda,
            tokenMint: mint1,
            exchangeTokenMint: mint2,
            poolTokenAccount: poolTokenAccount,
            poolExchangeTokenAccount: poolExchangeTokenAccount,
            userTokenAccount: userTokenAccount,
            dexConfigurationAccount: curveConfig,
            userExchangeTokenAccount: userExchangeTokenAccount,
            user: user2.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction()
      );

      tx.feePayer = user2.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      console.log(await connection.simulateTransaction(tx));

      const sig = await sendAndConfirmTransaction(connection, tx, [user2], {
        skipPreflight: true,
      });

      console.log(
        "Successfully added liquidity:",
        `https://solscan.io/tx/${sig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`
      );

      //log balance token mint1 và mint2  của user và pool
      const balance1 = await connection.getTokenAccountBalance(
        poolTokenAccount
      );
      const balance2 = await connection.getTokenAccountBalance(
        poolExchangeTokenAccount
      );
      console.log("Balance token mint1 : ", balance1.value.uiAmount);
      console.log("Balance token mint2 : ", balance2.value.uiAmount);
    } catch (error) {
      console.log("Error in adding liquidity:", error);
    }
  });

  it("Buy tokens", async () => {
    try {
      await connection.requestAirdrop(user3.publicKey, 10 ** 9);
      // Find configuration PDA
      const [curveConfig] = PublicKey.findProgramAddressSync(
        [Buffer.from(curveSeed)],
        program.programId
      );

      const curveConfigData = await program.account.curveConfiguration.fetch(curveConfig);
      const feeCollector = curveConfigData.feeCollector;

      // Find pool PDA with both token mints
      const [poolPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from(POOL_SEED_PREFIX),
          mint1.toBuffer(), // output token
          mint2.toBuffer(), // input token
        ],
        program.programId
      );

      // Get pool token accounts
      const poolOutputTokenAccount = await getAssociatedTokenAddress(
        mint1,
        poolPda,
        true
      );

      const poolInputTokenAccount = await getAssociatedTokenAddress(
        mint2,
        poolPda,
        true
      );

      // Get user token accounts
      const userOutputTokenAccount = await getAssociatedTokenAddress(
        mint1,
        user3.publicKey
      );

      const userInputTokenAccount = await getAssociatedTokenAddress(
        mint2,
        user3.publicKey
      );

      const amount = new BN(600 * 1_000_000_000); // Amount to buy

      const tx = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
        await program.methods
          .buy(amount)
          .accounts({
            dexConfigurationAccount: curveConfig,
            feeTokenCollector: feeCollector,
            pool: poolPda,
            outputTokenMint: mint1,
            inputTokenMint: mint2,
            poolOutputTokenAccount: poolOutputTokenAccount,
            poolInputTokenAccount: poolInputTokenAccount,
            userOutputTokenAccount: userOutputTokenAccount,
            userInputTokenAccount: userInputTokenAccount,
            user: user3.publicKey,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .instruction()
      );

      tx.feePayer = user3.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const sig = await sendAndConfirmTransaction(connection, tx, [user3], {
        skipPreflight: true,
      });

      console.log(
        "Successfully bought tokens:",
        `https://solscan.io/tx/${sig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`
      );
    } catch (error) {
      console.log("Error buying tokens:", error);
    }
  });

  it("Sell tokens", async () => {
    try {
      // Find configuration PDA
      const [curveConfig] = PublicKey.findProgramAddressSync(
        [Buffer.from(curveSeed)],
        program.programId
      );
      const curveConfigData = await program.account.curveConfiguration.fetch(curveConfig);
      const feeCollector = curveConfigData.feeCollector;

      // Find pool PDA
      const [poolPda, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from(POOL_SEED_PREFIX), mint1.toBuffer(), mint2.toBuffer()],
        program.programId
      );

      // Get pool token accounts
      const poolTokenAccount = await getAssociatedTokenAddress(
        mint1,
        poolPda,
        true
      );

      const poolExchangeTokenAccount = await getAssociatedTokenAddress(
        mint2,
        poolPda,
        true
      );

      // Get user token accounts
      const userTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        user3,
        mint1,
        user3.publicKey
      );

      const userExchangeTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        user3,
        mint2,
        user3.publicKey
      );

      const amount = new BN(10000 * 1_000_000_000); // Amount to sell

      const tx = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
        await program.methods
          .sell(amount)
          .accounts({
            dexConfigurationAccount: curveConfig,
            feeTokenCollector: feeCollector,
            pool: poolPda,
            tokenMint: mint1,
            exchangeTokenMint: mint2,
            poolTokenAccount: poolTokenAccount,
            poolExchangeTokenAccount: poolExchangeTokenAccount,
            userTokenAccount: userTokenAccount.address,
            userExchangeTokenAccount: userExchangeTokenAccount.address,
            user: user3.publicKey,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .instruction()
      );

      tx.feePayer = user3.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const sig = await sendAndConfirmTransaction(connection, tx, [user3], {
        skipPreflight: true,
      });

      console.log(
        "Successfully sold tokens:",
        `https://solscan.io/tx/${sig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`
      );
    } catch (error) {
      console.log("Error selling tokens:", error);
    }
  });

  it("Remove liquidity", async () => {
    try {
      const [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(POOL_SEED_PREFIX), mint1.toBuffer(), mint2.toBuffer()],
        program.programId
      );

      const poolToken = await getAssociatedTokenAddress(mint1, poolPda, true);

      const poolExchangeToken = await getAssociatedTokenAddress(
        mint2,
        poolPda,
        true
      );

      const userAta1 = await getOrCreateAssociatedTokenAccount(
        connection,
        user,
        mint1,
        user.publicKey
      );

      const userExchangeToken = await getAssociatedTokenAddress(
        mint2,
        user.publicKey
      );

      const adminToken = await getAssociatedTokenAddress(mint1, user.publicKey);

      const adminExchangeToken = await getAssociatedTokenAddress(
        mint2,
        user.publicKey
      );

      const [curveConfig] = PublicKey.findProgramAddressSync(
        [Buffer.from(curveSeed)],
        program.programId
      );

      const tx = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
        await program.methods
          .removeLiquidity()
          .accounts({
            pool: poolPda,
            tokenMint: mint1,
            exchangeTokenMint: mint2,
            poolTokenAccount: poolToken,
            userTokenAccount: userAta1.address,
            adminTokenAccount: adminToken,
            adminExchangeTokenAccount: adminExchangeToken,
            userExchangeTokenAccount: userExchangeToken,
            poolExchangeTokenAccount: poolExchangeToken,
            curveConfig: curveConfig,
            user: user.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction()
      );
      tx.feePayer = user.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      console.log(await connection.simulateTransaction(tx));
      const sig = await sendAndConfirmTransaction(connection, tx, [user], {
        skipPreflight: true,
      });
      console.log(
        "Successfully remove liquidity : ",
        `https://solscan.io/tx/${sig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`
      );
      // check balance token mint1 và mint2 của user và pool
      const balance1 = await connection.getTokenAccountBalance(
        userAta1.address
      );
      const balance2 = await connection.getTokenAccountBalance(
        userExchangeToken
      );
      console.log("Balance token mint1 : ", balance1.value.uiAmount);
      console.log("Balance token mint2 : ", balance2.value.uiAmount);
      transactions.push(`https://explorer.solana.com/tx/${sig}?cluster=devnet`);
      console.log("Transactions : ", transactions);
    } catch (error) {
      console.log("Error in removing liquidity", error);
    }
  });

  it("initialize proxy", async () => {
    const token0 = mint1;
    const token1 = mint2;

    const createPoolFee = createPoolFeeReceive;

    const [auth] = await getAuthAddress(cpSwapProgram);
    const [poolAddress] = await getPoolAddress(
      configAddress,
      token0,
      token1,
      cpSwapProgram
    );

    const [lpMintAddress] = await getPoolLpMintAddress(
      poolAddress,
      cpSwapProgram
    );

    const [vault0] = await getPoolVaultAddress(
      poolAddress,
      token0,
      cpSwapProgram
    );

    const [vault1] = await getPoolVaultAddress(
      poolAddress,
      token1,
      cpSwapProgram
    );

    const [creatorLpTokenAddress] = await PublicKey.findProgramAddress(
      [
        user.publicKey.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        lpMintAddress.toBuffer(),
      ],
      ASSOCIATED_PROGRAM_ID
    );

    const [observationAddress] = await getOrcleAccountAddress(
      poolAddress,
      cpSwapProgram
    );

    const creatorToken0 = getAssociatedTokenAddressSync(
      token0,
      user.publicKey,
      false,
      TOKEN_PROGRAM_ID
    );

    const creatorToken1 = getAssociatedTokenAddressSync(
      token1,
      user.publicKey,
      false,
      TOKEN_PROGRAM_ID
    );

    console.log({
      cpSwapProgram: cpSwapProgram,
      creator: user.publicKey,
      ammConfig: configAddress,
      authority: auth,
      poolState: poolAddress,
      token0Mint: token0,
      token1Mint: token1,
      lpMint: lpMintAddress,
      creatorToken0: creatorToken0,
      creatorToken1: creatorToken1,
      creatorLpToken: creatorLpTokenAddress,
      token0Vault: vault0,
      token1Vault: vault1,
      createPoolFee,
      observationState: observationAddress,
      tokenProgram: TOKEN_PROGRAM_ID,
      token0Program: TOKEN_PROGRAM_ID,
      token1Program: TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      user: user.publicKey,
    });

    const tx = await program.methods
      .proxyInitialize(new BN(100000), new BN(100000), new BN(0))
      .accounts({
        cpSwapProgram: cpSwapProgram,
        creator: user.publicKey,
        ammConfig: configAddress,
        authority: auth,
        poolState: poolAddress,
        token0Mint: token0,
        token1Mint: token1,
        lpMint: lpMintAddress,
        creatorToken0: creatorToken0,
        creatorToken1: creatorToken1,
        creatorLpToken: creatorLpTokenAddress,
        token0Vault: vault0,
        token1Vault: vault1,
        createPoolFee: createPoolFee,
        observationState: observationAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
        token0Program: TOKEN_PROGRAM_ID,
        token1Program: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .transaction();

    tx.feePayer = user.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    console.log(await connection.simulateTransaction(tx));

    const sig = await sendAndConfirmTransaction(connection, tx, [user]);
    console.log(sig);
  });
  console.log("Transactions : ", transactions);
});
