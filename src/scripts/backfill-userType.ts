// import "dotenv/config";
// import mongoose from "mongoose";
// import { DB } from "../controllers"; // adjust path if needed

// const run = async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URL!);
//     console.log("✅ Connected to MongoDB");

//     const User = DB.Models.User;

//     // ✅ Case 1: Users missing userType but have a role → copy role → userType
//     const result1 = await User.updateMany(
//       {
//         userType: { $exists: false },
//         role: { $exists: true, $ne: null },
//       },
//       [
//         {
//           $set: {
//             userType: "$role",
//           },
//         },
//       ]
//     );

//     // ✅ Case 2: Users missing BOTH userType and role → set userType = 'Landowners'
//     const result2 = await User.updateMany(
//       {
//         userType: { $exists: false },
//         $or: [{ role: { $exists: false } }, { role: null }],
//       },
//       {
//         $set: {
//           userType: "Landowners",
//         },
//       }
//     );

//     console.log("✅ Backfill complete.");
//     console.log(`→ ${result1.modifiedCount} users copied from role.`);
//     console.log(`→ ${result2.modifiedCount} users set to 'Landowners'.`);

//     process.exit(0);
//   } catch (err) {
//     console.error("❌ Backfill failed:", err);
//     process.exit(1);
//   }
// };

// run();
