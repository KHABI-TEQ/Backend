import "dotenv/config";
// import mongoose from "mongoose";
import mongoose, { Document, Types } from "mongoose";

// const run = async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URL!);
//     console.log("✅ Connected to MongoDB");

//     // Load Agent collection without enforcing schema (strict: false)
//     const Agent = mongoose.model(
//       "Agent",
//       new mongoose.Schema({}, { strict: false }),
//       "agents"
//     );

//     // Add `kycStatus` field if missing
//     const result = await Agent.updateMany(
//       { kycStatus: { $exists: false } },
//       { $set: { kycStatus: "none" } }
//     );

//     console.log(`✅ Backfill complete. Modified ${result.modifiedCount} agents.`);
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


// const run = async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URL!);
//     console.log("✅ Connected to MongoDB");

//     const Agent = mongoose.model(
//       "Agent",
//       new mongoose.Schema({}, { strict: false }),
//       "agents"
//     );

//     const result = await Agent.updateMany(
//       {},
//       {
//         $set: {
//           cacDoc: "",
//           agentLicenseNumber: "",
//           profileBio: "",
//           specializations: [],
//           languagesSpoken: [],
//           servicesOffered: [],
//           achievements: [],
//           featuredListings: [],
//           inspectionSettings: {
//             inspectionPrice: 0,
//             inspectionPriceEnabled: false,
//           },
//         },
//       }
//     );

//     console.log(`✅ Backfill complete. Modified ${result.modifiedCount} Agent documents.`);
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

//     // Remove the isInUpgrade field from all agents
//     const result = await Agent.updateMany(
//       { isFlagged: { $exists: true } },
//       { $unset: { isFlagged: "" } }
//     );

//     console.log(`✅ Successfully removed upgradeData from ${result.modifiedCount} Agent documents.`);
//     process.exit(0);
//   } catch (err) {
//     console.error("❌ Script failed:", err);
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

//     // Add 'achievements' field as an empty array of objects for all agents that don't have it
//     const result = await Agent.updateMany(
//       { achievements: { $exists: false } },
//       {
//         $set: {
//           achievements: [], // default empty array
//         },
//       }
//     );

//     console.log(`✅ Achievements column added. Modified ${result.modifiedCount} Agent documents.`);
//     process.exit(0);
//   } catch (err) {
//     console.error("❌ Failed to add achievements column:", err);
//     process.exit(1);
//   }
// };

// run();