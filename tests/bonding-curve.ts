import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction, ComputeBudgetProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js"
import { getAssociatedTokenAddress } from "@solana/spl-token"
import { expect } from "chai";
import { BN } from "bn.js";
import keys from '../keys/users.json'
import key2 from '../keys/user2.json'
import { ASSOCIATED_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BondingCurve, IDL } from "../target/types/bonding_curve";

// const connection = new Connection("https://devnet.helius-rpc.com/?api-key=b7e6f48d-5fc8-4da5-90e4-7827b60ba575", "confirmed")
const connection = new Connection("http://localhost:8899", "confirmed")
const curveSeed = "CurveConfiguration"
const POOL_SEED_PREFIX = "liquidity_pool"
const LIQUIDITY_SEED = "LiqudityProvider"
const SOL_VAULT_PREFIX = "liquidity_sol_vault"
function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

describe("bonding_curve", () => {
    // Thêm khai báo Program ID
    const PROGRAM_ID = new anchor.web3.PublicKey("EPt6ruottQ3o58rk6vJYDzfRQDdMkDsY21ojWyKGZvih");
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

    let mint1: PublicKey
    let tokenAta1: PublicKey

    // let mint2: PublicKey
    // let tokenAta2: PublicKey

    console.log("Admin's wallet address is : ", user.publicKey.toBase58())

    it("Airdrop to admin wallet", async () => {
        console.log(`Requesting airdrop to admin for 1SOL : ${user.publicKey.toBase58()}`)
        // 1 - Request Airdrop
        const signature = await connection.requestAirdrop(
            user.publicKey,
            10 ** 9
        );
        // 2 - Fetch the latest blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        // 3 - Confirm transaction success
        await connection.confirmTransaction({
            blockhash,
            lastValidBlockHeight,
            signature
        }, 'finalized');
        console.log("admin wallet balance : ", (await connection.getBalance(user.publicKey)) / 10 ** 9, "SOL")
    })

    it("Airdrop to user wallet", async () => {
        console.log("Created a user, address is ", user2.publicKey.toBase58())
        console.log(`Requesting airdrop for another user ${user.publicKey.toBase58()}`)
        // 1 - Request Airdrop
        const signature = await connection.requestAirdrop(
            user2.publicKey,
            10 ** 9
        );
        // 2 - Fetch the latest blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        // 3 - Confirm transaction success
        await connection.confirmTransaction({
            blockhash,
            lastValidBlockHeight,
            signature
        }, 'finalized');
        console.log("user balance : ", (await connection.getBalance(user.publicKey)) / 10 ** 9, "SOL")
    })

    it("Should create a new token", async () => {
        const randomId = Math.random().toString(36).substring(2, 15)
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
                        .initialize(1, new PublicKey("351g3DjKzZ1nXD4iydGBB5dFKGqF3JWs6DcvxzHAYouM"))
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
            const [poolPda] = PublicKey.findProgramAddressSync(
                [Buffer.from(POOL_SEED_PREFIX), mint1.toBuffer()],
                program.programId
            )
            const poolToken = await getAssociatedTokenAddress(
                mint1, poolPda, true
            )
            const tx = new Transaction()
                .add(
                    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
                    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
                    await program.methods
                        .createPool()
                        .accounts({
                            pool: poolPda,
                            tokenMint: mint1,
                            poolTokenAccount: poolToken,
                            payer: user.publicKey,
                            tokenProgram: TOKEN_PROGRAM_ID,
                            rent: SYSVAR_RENT_PUBKEY,
                            associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
                            systemProgram: SystemProgram.programId
                        })
                        .instruction()
                )
            tx.feePayer = user.publicKey
            tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
            console.log(await connection.simulateTransaction(tx))
            const sig = await sendAndConfirmTransaction(connection, tx, [user], { skipPreflight: true })
            console.log("Successfully created pool : ", `https://solscan.io/tx/${sig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`)
            transactions.push(`https://explorer.solana.com/tx/${sig}?cluster=devnet`)
        } catch (error) {
            console.log("Error in creating pool", error)
        }
    })

    it("add liquidity", async () => {
        try {

            const [poolPda] = PublicKey.findProgramAddressSync(
                [Buffer.from(POOL_SEED_PREFIX), mint1.toBuffer()],
                program.programId
            )

            const [poolSolVault] = PublicKey.findProgramAddressSync(
                [Buffer.from(SOL_VAULT_PREFIX), mint1.toBuffer()],
                program.programId
            )
            const poolToken = await getAssociatedTokenAddress(
                mint1, poolPda, true
            )

            const userAta1 = await getAssociatedTokenAddress(
                mint1, user.publicKey
            )

            const tx = new Transaction()
                .add(
                    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
                    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
                    await program.methods
                        .addLiquidity()
                        .accounts({
                            pool: poolPda,
                            poolSolVault: poolSolVault,
                            tokenMint: mint1,
                            poolTokenAccount: poolToken,
                            userTokenAccount: userAta1,
                            user: user.publicKey,
                            tokenProgram: TOKEN_PROGRAM_ID,
                            associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
                            rent: SYSVAR_RENT_PUBKEY,
                            systemProgram: SystemProgram.programId
                        })
                        .instruction()
                )
            tx.feePayer = user.publicKey
            tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
            console.log(await connection.simulateTransaction(tx))
            const sig = await sendAndConfirmTransaction(connection, tx, [user], { skipPreflight: true })
            console.log("Successfully added liquidity : ", `https://solscan.io/tx/${sig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`)
            transactions.push(`https://explorer.solana.com/tx/${sig}?cluster=devnet`)
            const userBalance = (await connection.getTokenAccountBalance(userAta1)).value.uiAmount
            const poolBalance = (await connection.getTokenAccountBalance(poolToken)).value.uiAmount
            console.log("after creating pool => userBalance:", userBalance)
            console.log("after creating pool => poolBalance:", poolBalance)
        } catch (error) {
            console.log("Error in adding liquidity", error)
        }
    })

    it("Buy token", async () => {
        try {
            const [curveConfig] = PublicKey.findProgramAddressSync(
                [Buffer.from(curveSeed)],
                program.programId
            )
            const [poolPda] = PublicKey.findProgramAddressSync(
                [Buffer.from(POOL_SEED_PREFIX), mint1.toBuffer()],
                program.programId
            )
            const poolToken = await getAssociatedTokenAddress(
                mint1, poolPda, true
            )
            const userAta1 = await getAssociatedTokenAddress(
                mint1, user.publicKey
            )
            const [poolSolVault, bump] = PublicKey.findProgramAddressSync(
                [Buffer.from(SOL_VAULT_PREFIX), mint1.toBuffer()],
                program.programId
            )
            const tx = new Transaction()
                .add(
                    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
                    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
                    await program.methods
                        .buy(new BN(10 ** 8), bump)
                        .accounts({
                            pool: poolPda,
                            tokenMint: mint1,
                            poolSolVault,
                            poolTokenAccount: poolToken,
                            userTokenAccount: userAta1,
                            dexConfigurationAccount: curveConfig,
                            feeCollector: new PublicKey("351g3DjKzZ1nXD4iydGBB5dFKGqF3JWs6DcvxzHAYouM"),
                            user: user.publicKey,
                            tokenProgram: TOKEN_PROGRAM_ID,
                            associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
                            rent: SYSVAR_RENT_PUBKEY,
                            systemProgram: SystemProgram.programId
                        })
                        .instruction()
                )
            tx.feePayer = user.publicKey
            tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
            console.log(await connection.simulateTransaction(tx))
            const sig = await sendAndConfirmTransaction(connection, tx, [user], { skipPreflight: true })
            console.log("Successfully bought : ", `https://solscan.io/tx/${sig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`)
            transactions.push(`https://explorer.solana.com/tx/${sig}?cluster=devnet`)
        } catch (error) {
            console.log("Error in buy transaction", error)
        }
    })

    it("Sell token", async () => {
        try {
            const [curveConfig] = PublicKey.findProgramAddressSync(
                [Buffer.from(curveSeed)],
                program.programId
            )
            const [poolPda] = PublicKey.findProgramAddressSync(
                [Buffer.from(POOL_SEED_PREFIX), mint1.toBuffer()],
                program.programId
            )
            const poolToken = await getAssociatedTokenAddress(
                mint1, poolPda, true
            )
            const userAta1 = await getAssociatedTokenAddress(
                mint1, user.publicKey
            )
            const [poolSolVault, bump] = PublicKey.findProgramAddressSync(
                [Buffer.from(SOL_VAULT_PREFIX), mint1.toBuffer()],
                program.programId
            )

            // Giảm số lượng token bán xuống
            const sellAmount = new BN(100000000000); // 0.001 token với 9 decimals

            const tx = new Transaction()
                .add(
                    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
                    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
                    await program.methods
                        .sell(sellAmount, bump)
                        .accounts({
                            pool: poolPda,
                            tokenMint: mint1,
                            poolSolVault,
                            poolTokenAccount: poolToken,
                            userTokenAccount: userAta1,
                            dexConfigurationAccount: curveConfig,
                            feeCollector: new PublicKey("351g3DjKzZ1nXD4iydGBB5dFKGqF3JWs6DcvxzHAYouM"),
                            user: user.publicKey,
                            tokenProgram: TOKEN_PROGRAM_ID,
                            associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
                            rent: SYSVAR_RENT_PUBKEY,
                            systemProgram: SystemProgram.programId
                        })
                        .instruction()
                )
            tx.feePayer = user.publicKey
            tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash

            const sig = await sendAndConfirmTransaction(connection, tx, [user], { skipPreflight: true })
            console.log("Successfully Sold : ", `https://solscan.io/tx/${sig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`)
            transactions.push(`https://explorer.solana.com/tx/${sig}?cluster=devnet`)
        } catch (error) {
            console.log("Error in sell transaction", error)
        }
    })

    it("Should calculate buy amount correctly", async () => {
        try {
            const [curveConfig] = PublicKey.findProgramAddressSync(
                [Buffer.from(curveSeed)],
                program.programId
            );

            const [poolPda] = PublicKey.findProgramAddressSync(
                [Buffer.from(POOL_SEED_PREFIX), mint1.toBuffer()],
                program.programId
            );

            // Test với các số lượng SOL khác nhau
            const testAmounts = [
                new BN(1_000_000_000), // 1 SOL
                new BN(2_000_000_000), // 2 SOL
                new BN(5_000_000_000), // 5 SOL
            ];

            for (const amount of testAmounts) {
                const tokenAmount = await program.methods
                    .calculateBuyAmount(amount)
                    .accounts({
                        dexConfigurationAccount: curveConfig,
                        pool: poolPda,
                        tokenMint: mint1,
                    })
                    .view();

                console.log(`With ${amount.toString()} lamports, you will receive ${tokenAmount.toString()} tokens`);
                expect(tokenAmount.toString()).to.not.equal('0');
            }
        } catch (error) {
            console.log("Error in calculate buy amount", error);
        }
    });

    it("Should calculate sell amount correctly", async () => {
        try {
            const [curveConfig] = PublicKey.findProgramAddressSync(
                [Buffer.from(curveSeed)],
                program.programId
            );

            const [poolPda] = PublicKey.findProgramAddressSync(
                [Buffer.from(POOL_SEED_PREFIX), mint1.toBuffer()],
                program.programId
            );

            // Test với các số lượng token khác nhau
            const testAmounts = [
                new BN(1_000_000_000), // 1 token
                new BN(10_000_000_000), // 10 tokens
                new BN(100_000_000_000), // 100 tokens
            ];

            for (const amount of testAmounts) {
                const solAmount = await program.methods
                    .calculateSellAmount(amount)
                    .accounts({
                        dexConfigurationAccount: curveConfig,
                        pool: poolPda,
                        tokenMint: mint1,
                    })
                    .view();

                console.log(`With ${amount.toString()} tokens, you will receive ${solAmount.toString()} lamports`);
                expect(solAmount.toString()).to.not.equal('0');
            }
        } catch (error) {
            console.log("Error in calculate sell amount", error);
        }
    });

    it("Should calculate market cap correctly", async () => {
        try {
            const [curveConfig] = PublicKey.findProgramAddressSync(
                [Buffer.from(curveSeed)],
                program.programId
            );

            const [poolPda] = PublicKey.findProgramAddressSync(
                [Buffer.from(POOL_SEED_PREFIX), mint1.toBuffer()],
                program.programId
            );

            const marketCap = await program.methods
                .calculateMarketCap()
                .accounts({
                    dexConfigurationAccount: curveConfig,
                    pool: poolPda,
                    tokenMint: mint1,
                })
                .view();

            console.log(`Market cap: ${marketCap.toString()}`);
            expect(marketCap.toString()).to.not.equal('0');

        } catch (error) {
            console.log("Error in calculate market cap", error);
        }
    })


    it("Remove liquidity", async () => {
        try {

            const [poolPda] = PublicKey.findProgramAddressSync(
                [Buffer.from(POOL_SEED_PREFIX), mint1.toBuffer()],
                program.programId
            )

            const poolToken = await getAssociatedTokenAddress(
                mint1, poolPda, true
            )
            const userAta1 = await getAssociatedTokenAddress(
                mint1, user.publicKey
            )
            const [poolSolVault, bump] = PublicKey.findProgramAddressSync(
                [Buffer.from(SOL_VAULT_PREFIX), mint1.toBuffer()],
                program.programId
            )

            const tx = new Transaction()
                .add(
                    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
                    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
                    await program.methods
                        .removeLiquidity(bump)
                        .accounts({
                            pool: poolPda,
                            tokenMint: mint1,
                            poolTokenAccount: poolToken,
                            userTokenAccount: userAta1,
                            poolSolVault,
                            user: user.publicKey,
                            tokenProgram: TOKEN_PROGRAM_ID,
                            associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
                            rent: SYSVAR_RENT_PUBKEY,
                            systemProgram: SystemProgram.programId
                        })
                        .instruction()
                )
            tx.feePayer = user.publicKey
            tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
            console.log(await connection.simulateTransaction(tx))
            const sig = await sendAndConfirmTransaction(connection, tx, [user], { skipPreflight: true })
            console.log("Successfully added liquidity : ", `https://solscan.io/tx/${sig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`)
            transactions.push(`https://explorer.solana.com/tx/${sig}?cluster=devnet`)
            console.log("Transactions : ", transactions)
        } catch (error) {
            console.log("Error in removing liquidity", error)
        }
    })

    console.log("Transactions : ", transactions)
});


