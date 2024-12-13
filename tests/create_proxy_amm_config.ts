// import * as anchor from "@coral-xyz/anchor";
// import { Program } from "@coral-xyz/anchor";
// import { Connection, PublicKey, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction, ComputeBudgetProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
// import { expect } from "chai";
// import keys from '../keys/users.json';
// import key2 from '../keys/user2.json';
// import { BondingCurve, IDL } from "../target/types/bonding_curve";

// const connection = new Connection("https://devnet.helius-rpc.com/?api-key=39c8a399-56e1-4a64-935d-aa8d04d8ba2c", "confirmed");
// // const connection = new Connection("http://localhost:8899", "confirmed")

// describe("bonding_curve", () => {
//     const PROGRAM_ID = new anchor.web3.PublicKey("78A1PbFdUqHAELkD2Ja8kaYzc3sYU2VEbjtsx1sfZHgr");
//     const program = new Program<BondingCurve>(
//         IDL,
//         PROGRAM_ID,
//         anchor.AnchorProvider.env()
//     ) as Program<BondingCurve>;

//     const user = Keypair.fromSecretKey(new Uint8Array(keys));
//     const user2 = Keypair.fromSecretKey(new Uint8Array(key2));
//     const transactions = [];

//     it("Create AMM Config", async () => {
//         try {
//             const index = 1;
//             const tradeFeeRate = new anchor.BN(1000);
//             const protocolFeeRate = new anchor.BN(500);
//             const fundFeeRate = new anchor.BN(200);
//             const createPoolFee = new anchor.BN(100);

//             const [ammConfig, bump] = await getAmmConfigAddress(index, PROGRAM_ID);

//             console.log("AMM Config: ", ammConfig.toBase58());

//             const tx = new Transaction().add(
//                 ComputeBudgetProgram.setComputeUnitLimit({ units: 20_000 }),
//                 ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1200_000 }),
//                 await program.methods
//                     .createAmmConfig(index, tradeFeeRate, protocolFeeRate, fundFeeRate, createPoolFee, bump)
//                     .accounts({
//                         owner: user.publicKey,
//                         ammConfig: ammConfig,
//                         systemProgram: SystemProgram.programId
//                     })
//                     .instruction()
//             );

//             tx.feePayer = user.publicKey;
//             tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

//             const sig = await sendAndConfirmTransaction(connection, tx, [user], { skipPreflight: true });
//             console.log("Successfully created AMM Config: ", `https://solscan.io/tx/${sig}?cluster=devnet`);
//             transactions.push(`https://explorer.solana.com/tx/${sig}?cluster=devnet`);
//         } catch (error) {
//             console.log("Error in creating AMM Config: ", error);
//         }
//     });

//     console.log("Transactions: ", transactions);
// });

// export const AMM_CONFIG_SEED = Buffer.from(
//     anchor.utils.bytes.utf8.encode("amm_config")
// );

// export async function getAmmConfigAddress(
//     index: number,
//     programId: PublicKey
// ): Promise<[PublicKey, number]> {
//     const [address, bump] = await PublicKey.findProgramAddress(
//         [AMM_CONFIG_SEED, u16ToBytes(index)],
//         programId
//     );
//     return [address, bump];
// }

// export function u16ToBytes(num: number) {
//     const arr = new ArrayBuffer(2);
//     const view = new DataView(arr);
//     view.setUint16(0, num, false);
//     return new Uint8Array(arr);
// }