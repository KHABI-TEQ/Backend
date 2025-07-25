// import "dotenv/config";
// import mongoose from "mongoose";
// import { DB } from "../controllers"; // Adjust path if needed

// const run = async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URL!);
//     console.log("✅ Connected to MongoDB");

//     const Preference = DB.Models.Preference;
//     const preferences = await Preference.find({});
//     let updatedCount = 0;

//     for (const pref of preferences) {
//       const { preferenceType, preferenceMode } = pref;
//       let expectedMode = preferenceMode;

//       switch (preferenceType) {
//         case "rent":
//           expectedMode = "tenant";
//           break;
//         case "joint-venture":
//           expectedMode = "developer";
//           break;
//         case "buy":
//           expectedMode = "buy";
//           break;
//         case "shortlet":
//           expectedMode = "shortlet";
//           break;
//         default:
//           expectedMode = preferenceMode;
//       }

//       // Only update if mode is different or missing
//       if (preferenceMode !== expectedMode) {
//         await Preference.updateOne(
//           { _id: pref._id },
//           { $set: { preferenceMode: expectedMode } }
//         );
//         updatedCount++;
//       }
//     }

//     console.log(`✅ preferenceMode updated for ${updatedCount} preferences.`);
//     process.exit(0);
//   } catch (err) {
//     console.error("❌ Failed to update preferenceMode:", err);
//     process.exit(1);
//   }
// };

// run();
