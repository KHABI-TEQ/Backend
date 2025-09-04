import "dotenv/config";
import mongoose from "mongoose";

// const run = async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URL!);
//     console.log("✅ Connected to MongoDB");

//     const User = mongoose.model("User", new mongoose.Schema({}, { strict: false }), "users");

//     // Add `isDeleted` field to users that don't have it
//     const result = await User.updateMany(
//       { isDeleted: { $exists: false } },
//       { $set: { isDeleted: false } }
//     );

//     console.log(`✅ Backfill complete. Modified ${result.modifiedCount} users.`);
//     process.exit(0);
//   } catch (err) {
//     console.error("❌ Backfill failed:", err);
//     process.exit(1);
//   }
// };

// run();







// import "dotenv/config";
// import mongoose from "mongoose";
// import crypto from "crypto";

// interface IUser {
//   _id: mongoose.Types.ObjectId;
//   referralCode: string;
// }

// const run = async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URL!);
//     console.log("✅ Connected to MongoDB");

//     const User = mongoose.model("User", new mongoose.Schema({}, { strict: false }), "users");

//     const users = await User.find({ referralCode: { $exists: true }, publicAccess: { $exists: false } });

//     let modifiedCount = 0;

//     for (const u of users) {
//       const user = u as unknown as IUser; // <-- type assertion

//       const rawString = `${user.referralCode}-${user._id}`;
//       const hash = crypto.createHash("sha256").update(rawString).digest("hex");
//       const uniqueUrl = hash.slice(0, 12);

//       await User.updateOne(
//         { _id: user._id },
//         { $set: { publicAccess: { url: uniqueUrl, urlEnabled: false } } }
//       );

//       modifiedCount++;
//     }

//     console.log(`✅ Backfill complete. Added publicAccess for ${modifiedCount} users.`);
//     process.exit(0);
//   } catch (err) {
//     console.error("❌ Backfill failed:", err);
//     process.exit(1);
//   }
// };

// run();




// const run = async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URL!);
//     console.log("✅ Connected to MongoDB");

//     const Agent = mongoose.model(
//       "Agent",
//       new mongoose.Schema({}, { strict: false }),
//       "agents"
//     );

//     // Backfill `inspectionSettings` where it doesn't exist
//     const result = await Agent.updateMany(
//       { inspectionSettings: { $exists: false } },
//       {
//         $set: {
//           inspectionSettings: {
//             inspectionPrice: 0,
//             inspectionPriceEnabled: false,
//           },
//         },
//       }
//     );

//     console.log(`✅ Added inspectionSettings to ${result.modifiedCount} agents.`);
//     process.exit(0);
//   } catch (err) {
//     console.error("❌ Backfill failed:", err);
//     process.exit(1);
//   }
// };

// run();