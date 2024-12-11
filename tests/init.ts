// import * as anchor from "@coral-xyz/anchor";
// import { Program } from "@coral-xyz/anchor";
// import { Connection, PublicKey, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction, ComputeBudgetProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js"
// import { createMint, getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token"
// import { expect } from "chai";
// import { BN } from "bn.js";
// import keys from '../keys/users.json'
// import key2 from '../keys/user2.json'
// import { TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
// import { ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
// import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
// import { BondingCurve, IDL } from "../target/types/bonding_curve";

// const connection = new Connection("https://devnet.helius-rpc.com/?api-key=39c8a399-56e1-4a64-935d-aa8d04d8ba2c", "confirmed")
// // const connection = new Connection("http://localhost:8899", "confirmed")
// const curveSeed = "CurveConfiguration"
// function sleep(ms: number) {
//     return new Promise(resolve => setTimeout(resolve, ms));
// }

// describe("bonding_curve", () => {
//     // Thêm khai báo Program ID
//     const PROGRAM_ID = new anchor.web3.PublicKey("7Ygc43fvZUGNujq1uzvww9b2kY71UMAptiv6vvYWK91S");
//     const transactions = [];
//     // Thay đổi cách khởi tạo program
//     const program = new Program<BondingCurve>(
//         IDL,
//         PROGRAM_ID,
//         anchor.AnchorProvider.env()
//     ) as Program<BondingCurve>;
//     // custom setting 
//     const user = Keypair.fromSecretKey(new Uint8Array(keys))
//     const user2 = Keypair.fromSecretKey(new Uint8Array(key2))
//     const tokenDecimal = 9
//     const amount = new BN(1000000000).mul(new BN(10 ** tokenDecimal))

//     const privateKeyBase58 = bs58.encode(new Uint8Array(keys));
//     console.log([privateKeyBase58].join(','))

//     let mint2: PublicKey = new PublicKey('GZjqqG1cuYfADAGW6WmSbctThXi3LTY77nhxKrS79fNv');
//     let tokenAta2: PublicKey = new PublicKey('GZjqqG1cuYfADAGW6WmSbctThXi3LTY77nhxKrS79fNv');

//     console.log("Admin's wallet address is : ", user.publicKey.toBase58())

//     it("Airdrop to admin wallet", async () => {
//         console.log(`Requesting airdrop to admin for 1SOL : ${user.publicKey.toBase58()}`)
//         // 1 - Request Airdrop
//         await connection.requestAirdrop(
//             user.publicKey,
//             10 ** 9
//         );
//     })

//     it("Airdrop to user wallet", async () => {
//         console.log("Created a user, address is ", user2.publicKey.toBase58())
//         console.log(`Requesting airdrop for another user ${user.publicKey.toBase58()}`)
//         // 1 - Request Airdrop
//         await connection.requestAirdrop(
//             user2.publicKey,
//             10 ** 9
//         );
//     })

//     // it("Mint token 2 to user wallet", async () => {
//     //     console.log("Trying to create and mint token 2 to user's wallet")
//     //     try {
//     //         mint2 = await createMint(connection, user, user.publicKey, user.publicKey, tokenDecimal)
//     //         console.log('mint 2 address: ', mint2.toBase58());

//     //         tokenAta2 = (await getOrCreateAssociatedTokenAccount(connection, user, mint2, user.publicKey)).address
//     //         console.log('token 2 account address: ', tokenAta2.toBase58());

//     //         await mintTo(connection, user, mint2, tokenAta2, user.publicKey, BigInt(amount.toString()))
//     //         const tokenBalance = await connection.getTokenAccountBalance(tokenAta2)
//     //         console.log("token 2 Balance in user:", tokenBalance.value.uiAmount)
//     //         console.log('token 2 successfully minted');
//     //     } catch (error) {
//     //         console.log("Token 2 creation error \n", error)
//     //     }
//     // })

//     it("Initialize the contract", async () => {
//         try {
//             const [curveConfig] = PublicKey.findProgramAddressSync(
//                 [Buffer.from(curveSeed)],
//                 program.programId
//             )
//             const tx = new Transaction()
//                 .add(
//                     ComputeBudgetProgram.setComputeUnitLimit({ units: 20_000 }),
//                     ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1200_000 }),
//                     await program.methods
//                         .initialize(1)
//                         .accounts({
//                             dexConfigurationAccount: curveConfig,
//                             admin: user.publicKey,
//                             rent: SYSVAR_RENT_PUBKEY,
//                             systemProgram: SystemProgram.programId
//                         })
//                         .instruction()
//                 )
//             tx.feePayer = user.publicKey
//             tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
//             console.log(await connection.simulateTransaction(tx))
//             const sig = await sendAndConfirmTransaction(connection, tx, [user], { skipPreflight: true })
//             console.log("Successfully initialized : ", `https://solscan.io/tx/${sig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`)
//             transactions.push(`https://explorer.solana.com/tx/${sig}?cluster=devnet`)
//             let pool = await program.account.curveConfiguration.fetch(curveConfig)
//             console.log("Pool State : ", pool)
//         } catch (error) {
//             console.log("Error in initialization :", error)
//         }
//     });
//     console.log("Transactions : ", transactions)
// });


