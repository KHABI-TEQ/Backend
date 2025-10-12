// import "dotenv/config";
// import mongoose from "mongoose";
// import { DB } from "../controllers"; // Adjust this path if needed
// import { generateUniqueReferralCode } from "../utils/generateUniqueAccountId";

// const run = async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URL!);
//     console.log("✅ Connected to MongoDB");

//     const User = DB.Models.User;

//     const users = await User.find({
//       $or: [
//         { referralCode: { $exists: false } },
//         { referredBy: { $exists: false } },
//       ],
//     });

//     let updatedCount = 0;

//     for (const user of users) {
//       const update: any = {};

//       if (!user.referralCode) {
//         update.referralCode = await generateUniqueReferralCode();
//       }

//       if (user.referredBy === undefined) {
//         update.referredBy = null;
//       }

//       if (Object.keys(update).length > 0) {
//         await User.updateOne({ _id: user._id }, { $set: update });
//         updatedCount++;
//       }
//     }

//     console.log(`✅ Referral backfill complete. ${updatedCount} users updated.`);
//     process.exit(0);
//   } catch (err) {
//     console.error("❌ Referral backfill failed:", err);
//     process.exit(1);
//   }
// };

// run();
