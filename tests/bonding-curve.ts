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
  createMint,
  createSyncNativeInstruction,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  transfer,
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
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import {
  getAuthAddress,
  getOrcleAccountAddress,
  getPoolAddress,
  getPoolLpMintAddress,
  getPoolVaultAddress,
} from "./utils";
import { configAddress, cpSwapProgram, createPoolFeeReceive } from "./config";
import { BondingCurve, IDL } from "../target/types/bonding_curve";

const connection = new Connection(
  "https://devnet.helius-rpc.com/?api-key=d5206d28-8772-4058-bca3-b6194c2133f3",
  "confirmed"
);
// const connection = new Connection("http://localhost:8899", "confirmed")
const curveSeed = "CurveConfiguration";
const POOL_SEED_PREFIX = "liquidity_pool";

describe("bonding_curve", () => {
  const PROGRAM_ID = new anchor.web3.PublicKey(
    "35gLkfqMXJUgrEntHV8C5UugnSjCeQRoCAgSYSstZEag"
  );
  const transactions = [];
  const program = new Program<BondingCurve>(
    IDL,
    PROGRAM_ID,
    anchor.AnchorProvider.env()
  ) as Program<BondingCurve>;

  const user = Keypair.fromSecretKey(new Uint8Array(keys));
  const user2 = Keypair.fromSecretKey(new Uint8Array(key2));
  const tokenDecimal = 9;
  const amount = new BN(1000000000).mul(new BN(10 ** tokenDecimal));
  const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
  );

  const privateKeyBase58 = bs58.encode(new Uint8Array(keys));
  console.log([privateKeyBase58].join(","));

  let mint1: PublicKey;
  let tokenAta1: PublicKey;

  let mint2: PublicKey = new PublicKey(
    "GZjqqG1cuYfADAGW6WmSbctThXi3LTY77nhxKrS79fNv"
  );
  let tokenAta2: PublicKey = new PublicKey(
    "7VKRZLGwRJgXTfcqSmoxtA44B1DBcAaKoMRnyamtZnhJ"
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
      user, // Payer for creating account
      mint2, // Token mint
      user2.publicKey // Owner of token account
    );

    // Transfer 1000 token mint2 cho user2
    await mintTo(
      connection,
      user, // Payer
      mint2, // Token mint
      user2TokenAccount.address, // Destination
      user.publicKey, // Mint authority
      1000 * 10 ** 9 // Amount (với 9 decimals)
    );
    // 1 - Request Airdrop
    await connection.requestAirdrop(user2.publicKey, 10 ** 9);
  });

  it("Should create a new token", async () => {
    const randomId = Math.random().toString(36).substring(2, 15);
    try {
      // Find PDA for mint
      const [mintPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("mint"),
          user2.publicKey.toBuffer(),
          Buffer.from(randomId), // thêm off_chain_id vào seeds
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

      // Create token with instruction
      const tx = await program.methods
        .createToken("Test Token 121324234234234322", "TEST", randomId)
        .accounts({
          mint: mintPda,
          user: user2.publicKey,
          userTokenAccount: userTokenPda,
          metadataAccount,
          mintAuthority: mintAuthorityPda,
          feeCollector: new PublicKey(
            "351g3DjKzZ1nXD4iydGBB5dFKGqF3JWs6DcvxzHAYouM"
          ),
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

  it("Initialize the contract", async () => {
    try {
      const [curveConfig] = PublicKey.findProgramAddressSync(
        [Buffer.from(curveSeed)],
        program.programId
      );
      const tx = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 20_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1200_000 }),
        await program.methods
          .initialize(1)
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
      const sig = await sendAndConfirmTransaction(connection, finalTx, [user2], {
        skipPreflight: true,
      });
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
      // Find configuration PDA
      const [curveConfig] = PublicKey.findProgramAddressSync(
        [Buffer.from(curveSeed)],
        program.programId
      );

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
        user.publicKey
      );

      const userInputTokenAccount = await getAssociatedTokenAddress(
        mint2,
        user.publicKey
      );

      const amount = new BN(1_000_000_000); // Amount to buy

      const tx = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
        await program.methods
          .buy(amount)
          .accounts({
            dexConfigurationAccount: curveConfig,
            pool: poolPda,
            outputTokenMint: mint1,
            inputTokenMint: mint2,
            poolOutputTokenAccount: poolOutputTokenAccount,
            poolInputTokenAccount: poolInputTokenAccount,
            userOutputTokenAccount: userOutputTokenAccount,
            userInputTokenAccount: userInputTokenAccount,
            user: user.publicKey,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .instruction()
      );

      tx.feePayer = user.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const sig = await sendAndConfirmTransaction(connection, tx, [user], {
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
      const userTokenAccount = await getAssociatedTokenAddress(
        mint1,
        user.publicKey
      );

      const userExchangeTokenAccount = await getAssociatedTokenAddress(
        mint2,
        user.publicKey
      );

      const amount = new BN(10000 * 1_000_000_000); // Amount to sell

      const tx = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
        await program.methods
          .sell(amount)
          .accounts({
            dexConfigurationAccount: curveConfig,
            pool: poolPda,
            tokenMint: mint1,
            exchangeTokenMint: mint2,
            poolTokenAccount: poolTokenAccount,
            poolExchangeTokenAccount: poolExchangeTokenAccount,
            userTokenAccount: userTokenAccount,
            userExchangeTokenAccount: userExchangeTokenAccount,
            user: user.publicKey,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .instruction()
      );

      tx.feePayer = user.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const sig = await sendAndConfirmTransaction(connection, tx, [user], {
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

      const userAta1 = await getAssociatedTokenAddress(mint1, user.publicKey);

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
            userTokenAccount: userAta1,
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
      const balance1 = await connection.getTokenAccountBalance(userAta1);
      const balance2 = await connection.getTokenAccountBalance(userExchangeToken);
      console.log("Balance token mint1 : ", balance1.value.uiAmount);
      console.log("Balance token mint2 : ", balance2.value.uiAmount);
      transactions.push(`https://explorer.solana.com/tx/${sig}?cluster=devnet`);
      console.log("Transactions : ", transactions);
    } catch (error) {
      console.log("Error in removing liquidity", error);
    }
  });

  // it("initialize proxy", async () => {
  //   const token0 = NATIVE_MINT;
  //   const token1 = mint2;

  //   const wSolAta = await getOrCreateAssociatedTokenAccount(
  //     connection,
  //     user,
  //     NATIVE_MINT,
  //     user.publicKey
  //   );

  //   // wrap Sol
  //   let transaction = new Transaction().add(
  //     // trasnfer SOL
  //     SystemProgram.transfer({
  //       fromPubkey: user.publicKey,
  //       toPubkey: wSolAta.address,
  //       lamports: LAMPORTS_PER_SOL,
  //     }),
  //     // sync wrapped SOL balance
  //     createSyncNativeInstruction(wSolAta.address)
  //   );

  //   // submit transaction
  //   const txSignature = await sendAndConfirmTransaction(
  //     connection,
  //     transaction,
  //     [user]
  //   );

  //   // validate transaction was successful
  //   try {
  //     const latestBlockhash = await connection.getLatestBlockhash();
  //     await connection.confirmTransaction(
  //       {
  //         blockhash: latestBlockhash.blockhash,
  //         lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  //         signature: txSignature,
  //       },
  //       "confirmed"
  //     );
  //   } catch (error) {
  //     console.log(`Error wrapping sol: ${error}`);
  //   }

  //   console.log("wrapped sol", txSignature);

  //   const createPoolFee = createPoolFeeReceive;

  //   const [auth] = await getAuthAddress(cpSwapProgram);
  //   const [poolAddress] = await getPoolAddress(
  //     configAddress,
  //     token0,
  //     token1,
  //     cpSwapProgram
  //   );

  //   const [lpMintAddress] = await getPoolLpMintAddress(
  //     poolAddress,
  //     cpSwapProgram
  //   );

  //   const [vault0] = await getPoolVaultAddress(
  //     poolAddress,
  //     token0,
  //     cpSwapProgram
  //   );

  //   const [vault1] = await getPoolVaultAddress(
  //     poolAddress,
  //     token1,
  //     cpSwapProgram
  //   );

  //   const [creatorLpTokenAddress] = await PublicKey.findProgramAddress(
  //     [
  //       user.publicKey.toBuffer(),
  //       TOKEN_PROGRAM_ID.toBuffer(),
  //       lpMintAddress.toBuffer(),
  //     ],
  //     ASSOCIATED_PROGRAM_ID
  //   );

  //   const [observationAddress] = await getOrcleAccountAddress(
  //     poolAddress,
  //     cpSwapProgram
  //   );

  //   const creatorToken0 = getAssociatedTokenAddressSync(
  //     token0,
  //     user.publicKey,
  //     false,
  //     TOKEN_PROGRAM_ID
  //   );

  //   const creatorToken1 = getAssociatedTokenAddressSync(
  //     token1,
  //     user.publicKey,
  //     false,
  //     TOKEN_PROGRAM_ID
  //   );

  //   console.log({
  //     cpSwapProgram: cpSwapProgram,
  //     creator: user.publicKey,
  //     ammConfig: configAddress,
  //     authority: auth,
  //     poolState: poolAddress,
  //     token0Mint: token0,
  //     token1Mint: token1,
  //     lpMint: lpMintAddress,
  //     creatorToken0: creatorToken0,
  //     creatorToken1: creatorToken1,
  //     creatorLpToken: creatorLpTokenAddress,
  //     token0Vault: vault0,
  //     token1Vault: vault1,
  //     createPoolFee,
  //     observationState: observationAddress,
  //     tokenProgram: TOKEN_PROGRAM_ID,
  //     token0Program: TOKEN_PROGRAM_ID,
  //     token1Program: TOKEN_PROGRAM_ID,
  //     rent: SYSVAR_RENT_PUBKEY,
  //     associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  //     systemProgram: SystemProgram.programId,
  //     user: user.publicKey,
  //   });

  //   const tx = await program.methods
  //     .proxyInitialize(new BN(100000), new BN(100000), new BN(0))
  //     .accounts({
  //       cpSwapProgram: cpSwapProgram,
  //       creator: user.publicKey,
  //       ammConfig: configAddress,
  //       authority: auth,
  //       poolState: poolAddress,
  //       token0Mint: token0,
  //       token1Mint: token1,
  //       lpMint: lpMintAddress,
  //       creatorToken0: creatorToken0,
  //       creatorToken1: creatorToken1,
  //       creatorLpToken: creatorLpTokenAddress,
  //       token0Vault: vault0,
  //       token1Vault: vault1,
  //       createPoolFee: createPoolFee,
  //       observationState: observationAddress,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //       token0Program: TOKEN_PROGRAM_ID,
  //       token1Program: TOKEN_PROGRAM_ID,
  //       rent: SYSVAR_RENT_PUBKEY,
  //       associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  //       systemProgram: SystemProgram.programId,
  //     })
  //     .signers([user])
  //     .transaction();

  //   tx.feePayer = user.publicKey;
  //   tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  //   console.log(await connection.simulateTransaction(tx));

  //   const sig = await sendAndConfirmTransaction(connection, tx, [user]);
  //   console.log(sig);
  // });
  console.log("Transactions : ", transactions);
});
