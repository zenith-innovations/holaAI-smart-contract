// import * as anchor from "@coral-xyz/anchor";
// import { Program } from "@coral-xyz/anchor";
// import { BondingCurve } from "../target/types/bonding_curve";
// import { IDL } from "../target/types/bonding_curve";
// import {
//     Connection,
//     PublicKey,
//     Keypair,
//     SystemProgram,
//     SYSVAR_RENT_PUBKEY
// } from "@solana/web3.js";
// import {
//     TOKEN_PROGRAM_ID,
//     ASSOCIATED_TOKEN_PROGRAM_ID,
//     getAssociatedTokenAddress
// } from "@solana/spl-token";
// import { expect } from "chai";
// import keys from '../keys/users.json';

// const PROGRAM_ID = new anchor.web3.PublicKey("3RgwNfTHPGqMMosCNmQjoCbrMsume9ACSCUmWsbfdW1q")

// describe("Create Token Test", () => {
//     // Configure the client to use the local cluster
//     const program = new Program<BondingCurve>(
//         IDL,
//         PROGRAM_ID,
//         anchor.AnchorProvider.env()
//     ) as Program<BondingCurve>;
//     const connection = new Connection("http://localhost:8899", "confirmed");

//     // Test account
//     const user = Keypair.fromSecretKey(new Uint8Array(keys));
//     let mint: PublicKey;
//     let userTokenAccount: PublicKey;

//     it("Airdrop to test wallet", async () => {
//         try {
//             const airdropSignature = await connection.requestAirdrop(
//                 user.publicKey,
//                 2 * anchor.web3.LAMPORTS_PER_SOL // 2 SOL
//             );
//             await connection.confirmTransaction(airdropSignature);

//             const balance = await connection.getBalance(user.publicKey);
//             console.log(`Wallet balance: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);
//             expect(balance).to.be.above(0);
//         } catch (error) {
//             console.error("Airdrop failed:", error);
//             throw error;
//         }
//     });

//     it("Should create a new token", async () => {
//         const randomId = Math.random().toString(36).substring(2, 15);
//         try {
//             // Find PDA for mint
//             const [mintPda] = PublicKey.findProgramAddressSync(
//                 [
//                     Buffer.from("mint"),
//                     user.publicKey.toBuffer(),
//                     Buffer.from(randomId) // thêm off_chain_id vào seeds
//                 ],
//                 program.programId
//             );

//             // Get associated token account
//             const userTokenPda = await getAssociatedTokenAddress(
//                 mintPda,
//                 user.publicKey
//             );

//             // Create token with instruction
//             const tx = await program.methods
//                 .createToken(
//                     "Test Token 1212",
//                     "TEST",
//                     randomId
//                 )
//                 .accounts({
//                     mint: mintPda,
//                     user: user.publicKey,
//                     userTokenAccount: userTokenPda,
//                     tokenProgram: TOKEN_PROGRAM_ID,
//                     associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
//                     systemProgram: SystemProgram.programId,
//                     rent: SYSVAR_RENT_PUBKEY,
//                 })
//                 .signers([user])
//                 .rpc();

//             // Wait for confirmation
//             await connection.confirmTransaction(tx);
//             console.log("Transaction signature:", tx);

//             // Store addresses for later use
//             mint = mintPda;
//             userTokenAccount = userTokenPda;

//             // Log addresses
//             console.log("Mint address:", mint.toBase58());
//             console.log("Token account:", userTokenAccount.toBase58());

//             // Verify token account exists and has correct balance
//             const tokenBalance = await connection.getTokenAccountBalance(userTokenAccount);
//             console.log("Token balance:", tokenBalance.value.uiAmount);

//             console.log(`Transaction: https://solscan.io/tx/${tx}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`)

//             // Assertions
//             expect(tokenBalance.value.uiAmount).to.equal(2000000); // 1000 tokens minted
//             expect(tokenBalance.value.decimals).to.equal(9); // 9 decimals

//         } catch (error) {
//             console.error("Failed to create token:", error);
//             throw error;
//         }
//     });

//     it("Should verify token metadata", async () => {
//         try {
//             // Get mint info
//             const mintInfo = await connection.getAccountInfo(mint);
//             expect(mintInfo).to.not.be.null;
//             expect(mintInfo?.owner.toBase58()).to.equal(TOKEN_PROGRAM_ID.toBase58());

//             // Get token account info
//             const tokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
//             expect(tokenAccountInfo).to.not.be.null;
//             expect(tokenAccountInfo?.owner.toBase58()).to.equal(TOKEN_PROGRAM_ID.toBase58());

//         } catch (error) {
//             console.error("Failed to verify token metadata:", error);
//             throw error;
//         }
//     });
// });