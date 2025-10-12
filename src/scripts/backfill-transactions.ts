// import "dotenv/config";
// import mongoose from "mongoose";
// import { DB } from "../controllers"; // adjust path if needed

// const run = async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URL!);
//     console.log("✅ Connected to MongoDB");

//     const Transaction = DB.Models.NewTransaction; // ensure lowercase if that's your registration name

//     const result = await Transaction.updateMany(
//       {}, // all records
//       { $set: { transactionFlow: 'internal' } }
//     );

//     console.log(`✅ Backfill complete. ${result.modifiedCount} transactions updated.`);
//     process.exit(0);
//   } catch (err) {
//     console.error("❌ Backfill failed:", err);
//     process.exit(1);
//   }
// };

// run();
