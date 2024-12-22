// import * as anchor from "@coral-xyz/anchor";
// import { Program } from "@coral-xyz/anchor";
// import {
//   Connection,
//   PublicKey,
//   Keypair,
//   SystemProgram,
//   Transaction,
//   sendAndConfirmTransaction,
//   ComputeBudgetProgram,
//   SYSVAR_RENT_PUBKEY,
// } from "@solana/web3.js";
// import {
//   createMint,
//   getAssociatedTokenAddress,
//   getMint,
//   getOrCreateAssociatedTokenAccount,
//   mintTo,
// } from "@solana/spl-token";
// import { expect } from "chai";
// import { BN } from "bn.js";
// import keys from "../keys/users.json";
// import key2 from "../keys/user2.json";
// import { TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
// import { ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
// import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
// import { BondingCurve, IDL } from "../target/types/bonding_curve";
// import { 
//     createMetadataAccountV3,
//     DataV2
// } from "@metaplex-foundation/mpl-token-metadata";
// const connection = new Connection(
//   "https://devnet.helius-rpc.com/?api-key=d5206d28-8772-4058-bca3-b6194c2133f3",
//   "confirmed"
// );
// // const connection = new Connection("http://localhost:8899", "confirmed")
// const curveSeed = "CurveConfiguration";
// function sleep(ms: number) {
//   return new Promise((resolve) => setTimeout(resolve, ms));
// }

// describe("bonding_curve", () => {
//   // Thêm khai báo Program ID
//   const PROGRAM_ID = new anchor.web3.PublicKey(
//     "43zsC4m9jKa1AZJuVpNLxpWFFNqopRHspv9F4Wko7Wsr"
//   );
//   const transactions = [];
//   // Thay đổi cách khởi tạo program
//   const program = new Program<BondingCurve>(
//     IDL,
//     PROGRAM_ID,
//     anchor.AnchorProvider.env()
//   ) as Program<BondingCurve>;
//   // custom setting
//   const user = Keypair.fromSecretKey(new Uint8Array(keys));
//   const user2 = Keypair.fromSecretKey(new Uint8Array(key2));
//   const user3 = Keypair.generate();
//   console.log("user3", user3.publicKey.toBase58());
//   console.log("private key", bs58.encode(new Uint8Array(user3.secretKey)));
//   const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
//     "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
//   );
//   const privateKeyBase58 = bs58.encode(new Uint8Array(keys));
//   console.log([privateKeyBase58].join(","));

//   let mint2: PublicKey = new PublicKey("HZsBgcpDRA6G2X7suKVhmddZMfmrS3ZscXjJNhEoC9qy");

//   console.log("Admin's wallet address is : ", user.publicKey.toBase58());

//   it("Airdrop to admin wallet", async () => {
//     console.log(
//       `Requesting airdrop to admin for 1SOL : ${user.publicKey.toBase58()}`
//     );
//     // 1 - Request Airdrop
//     await connection.requestAirdrop(user.publicKey, 10 ** 9);
//     await connection.requestAirdrop(user3.publicKey, 10 ** 9);
//     await connection.requestAirdrop(user2.publicKey, 10 ** 9);
//   });

//   it("Initialize the contract", async () => {
//     try {
//       const [curveConfig] = PublicKey.findProgramAddressSync(
//         [Buffer.from(curveSeed)],
//         program.programId
//       );
//       const feeTokenCollector = await getOrCreateAssociatedTokenAccount(
//         connection,
//         user,
//         mint2,
//         user.publicKey
//       );
//       const tx = new Transaction().add(
//         ComputeBudgetProgram.setComputeUnitLimit({ units: 20_000 }),
//         ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1200_000 }),
//         await program.methods
//           .initialize(
//             new BN(100), // fee percentage
//             new BN(0.1 * 10 ** 9), // creation fees
//             1280, // proportion
//             feeTokenCollector.address, // fee collector
//             user.publicKey, // fee sol collector
//             new BN(1_000_000_000) // initial token for pool
//           )
//           .accounts({
//             dexConfigurationAccount: curveConfig,
//             admin: user.publicKey,
//             rent: SYSVAR_RENT_PUBKEY,
//             systemProgram: SystemProgram.programId,
//           })
//           .instruction()
//       );
//       tx.feePayer = user.publicKey;
//       tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
//       console.log(await connection.simulateTransaction(tx));
//       const sig = await sendAndConfirmTransaction(connection, tx, [user], {
//         skipPreflight: true,
//       });
//       console.log(
//         "Successfully initialized : ",
//         `https://solscan.io/tx/${sig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`
//       );
//       transactions.push(`https://explorer.solana.com/tx/${sig}?cluster=devnet`);
//       let pool = await program.account.curveConfiguration.fetch(curveConfig);
//       console.log("Pool State : ", pool);
//     } catch (error) {
//       console.log("Error in initialization :", error);
//     }
//   });
//   console.log("Transactions : ", transactions);
// });
