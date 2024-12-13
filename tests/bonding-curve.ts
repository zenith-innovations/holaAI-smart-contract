import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction, ComputeBudgetProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js"
import { createMint, getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token"
import { expect } from "chai";
import { BN } from "bn.js";
import keys from '../keys/users.json'
import key2 from '../keys/user2.json'
import { TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { BondingCurve, IDL } from "../target/types/bonding_curve";

const connection = new Connection("https://devnet.helius-rpc.com/?api-key=39c8a399-56e1-4a64-935d-aa8d04d8ba2c", "confirmed")
// const connection = new Connection("http://localhost:8899", "confirmed")
const curveSeed = "CurveConfiguration"
const POOL_SEED_PREFIX = "liquidity_pool"

describe("bonding_curve", () => {
    // Thêm khai báo Program ID
    const PROGRAM_ID = new anchor.web3.PublicKey("A4epyqMTKBJ6tvgnm7VqgNpkvRTeb9LsrpoUHV4Fyguj");
    const transactions = [];
    // Thay đổi cách khởi tạo program
    const program = new Program<BondingCurve>(
        IDL,
        PROGRAM_ID,
        anchor.AnchorProvider.env()
    ) as Program<BondingCurve>;
    // custom setting 
    const user = Keypair.fromSecretKey(new Uint8Array(keys))
    const user2 = Keypair.fromSecretKey(new Uint8Array(key2))
    const tokenDecimal = 9
    const amount = new BN(1000000000).mul(new BN(10 ** tokenDecimal))
    const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

    const privateKeyBase58 = bs58.encode(new Uint8Array(keys));
    console.log([privateKeyBase58].join(','))

    let mint1: PublicKey
    let tokenAta1: PublicKey

    let mint2: PublicKey = new PublicKey("GZjqqG1cuYfADAGW6WmSbctThXi3LTY77nhxKrS79fNv");
    let tokenAta2: PublicKey = new PublicKey("7VKRZLGwRJgXTfcqSmoxtA44B1DBcAaKoMRnyamtZnhJ");

    console.log("Admin's wallet address is : ", user.publicKey.toBase58())

    it("Airdrop to admin wallet", async () => {
        console.log(`Requesting airdrop to admin for 1SOL : ${user.publicKey.toBase58()}`)
        // 1 - Request Airdrop
        await connection.requestAirdrop(
            user.publicKey,
            10 ** 9
        );
    })

    it("Airdrop to user wallet", async () => {
        console.log("Created a user, address is ", user2.publicKey.toBase58())
        console.log(`Requesting airdrop for another user ${user.publicKey.toBase58()}`)
        // 1 - Request Airdrop
        await connection.requestAirdrop(
            user2.publicKey,
            10 ** 9
        );

    })

    it("Should create a new token", async () => {
        const randomId = Math.random().toString(36).substring(2, 15);
        try {
            // Find PDA for mint
            const [mintPda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("mint"),
                    user.publicKey.toBuffer(),
                    Buffer.from(randomId) // thêm off_chain_id vào seeds
                ],
                program.programId
            );

            // Get associated token account
            const userTokenPda = await getAssociatedTokenAddress(
                mintPda,
                user.publicKey
            );

            // UPDATE 2024-12-07:
            // Find PDA for metadata account
            const [metadataAccount] = await PublicKey.findProgramAddressSync(
                [
                    Buffer.from("metadata"),
                    TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                    mintPda.toBuffer()
                ],
                TOKEN_METADATA_PROGRAM_ID
            );

            const [mintAuthorityPda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("mint_authority"),
                    mintPda.toBuffer(),
                ],
                program.programId
            );


            // Create token with instruction
            const tx = await program.methods
                .createToken(
                    "Test Token 121324234234234322",
                    "TEST",
                    randomId,
                    true
                )
                .accounts({
                    mint: mintPda,
                    user: user.publicKey,
                    userTokenAccount: userTokenPda,
                    metadataAccount,
                    mintAuthority: mintAuthorityPda,
                    feeCollector: new PublicKey("351g3DjKzZ1nXD4iydGBB5dFKGqF3JWs6DcvxzHAYouM"),
                    tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    rent: SYSVAR_RENT_PUBKEY,
                })
                .signers([user])
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

    it("Mint token 2 to user wallet", async () => {
        console.log("Trying to create and mint token 2 to user's wallet")
        try {
            mint2 = await createMint(connection, user, user.publicKey, user.publicKey, tokenDecimal)
            console.log('mint 2 address: ', mint2.toBase58());

            tokenAta2 = (await getOrCreateAssociatedTokenAccount(connection, user, mint2, user.publicKey)).address
            console.log('token 2 account address: ', tokenAta2.toBase58());

            await mintTo(connection, user, mint2, tokenAta2, user.publicKey, BigInt(amount.toString()))
            const tokenBalance = await connection.getTokenAccountBalance(tokenAta2)
            console.log("token 2 Balance in user:", tokenBalance.value.uiAmount)
            console.log('token 2 successfully minted');
        } catch (error) {
            console.log("Token 2 creation error \n", error)
        }
    })

    it("Initialize the contract", async () => {
        try {
            const [curveConfig] = PublicKey.findProgramAddressSync(
                [Buffer.from(curveSeed)],
                program.programId
            )
            const tx = new Transaction()
                .add(
                    ComputeBudgetProgram.setComputeUnitLimit({ units: 20_000 }),
                    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1200_000 }),
                    await program.methods
                        .initialize(1)
                        .accounts({
                            dexConfigurationAccount: curveConfig,
                            admin: user.publicKey,
                            rent: SYSVAR_RENT_PUBKEY,
                            systemProgram: SystemProgram.programId
                        })
                        .instruction()
                )
            tx.feePayer = user.publicKey
            tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
            console.log(await connection.simulateTransaction(tx))
            const sig = await sendAndConfirmTransaction(connection, tx, [user], { skipPreflight: true })
            console.log("Successfully initialized : ", `https://solscan.io/tx/${sig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`)
            transactions.push(`https://explorer.solana.com/tx/${sig}?cluster=devnet`)
            let pool = await program.account.curveConfiguration.fetch(curveConfig)
            console.log("Pool State : ", pool)
        } catch (error) {
            console.log("Error in initialization :", error)
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
                    payer: user.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    rent: SYSVAR_RENT_PUBKEY,
                    systemProgram: SystemProgram.programId,
                })
                .transaction();

            // Add compute budget instructions
            const finalTx = new Transaction()
                .add(
                    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
                    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
                    tx
                );

            finalTx.feePayer = user.publicKey;
            finalTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

            // Send and confirm transaction
            const sig = await sendAndConfirmTransaction(
                connection,
                finalTx,
                [user],
                { skipPreflight: true }
            );
            //log balance token 1 và 2  của user và pool
            const balance1 = await connection.getTokenAccountBalance(poolTokenAccount)
            const balance2 = await connection.getTokenAccountBalance(poolExchangeTokenAccount)
            console.log("Balance token 1 : ", balance1.value.uiAmount)
            console.log("Balance token 2 : ", balance2.value.uiAmount)

            console.log("Successfully created pool:",
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
                [
                    Buffer.from(POOL_SEED_PREFIX),
                    mint1.toBuffer(),
                    mint2.toBuffer()
                ],
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

            const tx = new Transaction()
                .add(
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
                            user: user.publicKey,
                            tokenProgram: TOKEN_PROGRAM_ID,
                            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                            systemProgram: SystemProgram.programId,
                        })
                        .instruction()
                );

            tx.feePayer = user.publicKey;
            tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

            console.log(await connection.simulateTransaction(tx));

            const sig = await sendAndConfirmTransaction(
                connection,
                tx,
                [user],
                { skipPreflight: true }
            );

            console.log(
                "Successfully added liquidity:",
                `https://solscan.io/tx/${sig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`
            );

            //log balance token mint1 và mint2  của user và pool
            const balance1 = await connection.getTokenAccountBalance(poolTokenAccount)
            const balance2 = await connection.getTokenAccountBalance(poolExchangeTokenAccount)
            console.log("Balance token mint1 : ", balance1.value.uiAmount)
            console.log("Balance token mint2 : ", balance2.value.uiAmount)

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
                    mint2.toBuffer()  // input token
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

            const tx = new Transaction()
                .add(
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

            const sig = await sendAndConfirmTransaction(
                connection,
                tx,
                [user],
                { skipPreflight: true }
            );

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
                [
                    Buffer.from(POOL_SEED_PREFIX),
                    mint1.toBuffer(),
                    mint2.toBuffer()
                ],
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

            const tx = new Transaction()
                .add(
                    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
                    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
                    await program.methods
                        .sell(amount, bump)
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

            const sig = await sendAndConfirmTransaction(
                connection,
                tx,
                [user],
                { skipPreflight: true }
            );

            console.log(
                "Successfully sold tokens:",
                `https://solscan.io/tx/${sig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`
            );

        } catch (error) {
            console.log("Error selling tokens:", error);
        }
    });


    console.log("Transactions : ", transactions)
});


