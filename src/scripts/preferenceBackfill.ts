// import "dotenv/config";
// import mongoose from "mongoose";
// import { DB } from "../controllers"; // adjust path if needed

// const run = async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URL!);
//     console.log("✅ Connected to MongoDB");

//     const Preference = DB.Models.Preference;
//     const preferences = await Preference.find({});
//     let updatedCount = 0;

//     for (const pref of preferences) {
//       const update: any = {};

//       // Top-level primitives
//       if (pref.preferenceType === undefined) update.preferenceType = "buy";
//       if (pref.preferenceMode === undefined) update.preferenceMode = "buy";
//       if (pref.budgetMin === undefined) update.budgetMin = 0;
//       if (pref.budgetMax === undefined) update.budgetMax = 0;
//       if (pref.currency === undefined) update.currency = "NGN";
//       if (pref.landSize === undefined) update.landSize = 0;
//       if (pref.measurementType === undefined) update.measurementType = "";
//       if (pref.nearbyLandmark === undefined) update.nearbyLandmark = "";
//       if (pref.additionalInfo === undefined) update.additionalInfo = "";
//       if (pref.status === undefined) update.status = "pending";

//       // Arrays
//       if (!Array.isArray(pref.documents)) update.documents = [];
//       if (!Array.isArray(pref.features)) update.features = [];

//       // Nested: location
//       if (!pref.location || typeof pref.location !== "object") {
//         update.location = {
//           state: "",
//           localGovernmentAreas: [],
//           lgasWithAreas: [],
//           customLocation: "",
//         };
//       } else {
//         update.location = {
//           state: pref.location.state ?? "",
//           localGovernmentAreas: pref.location.localGovernmentAreas ?? [],
//           lgasWithAreas: pref.location.lgasWithAreas ?? [],
//           customLocation: pref.location.customLocation ?? "",
//         };
//       }

//       // Mixed fields
//       if (pref.propertyDetails === undefined) update.propertyDetails = {};
//       if (pref.developmentDetails === undefined) update.developmentDetails = {};
//       if (pref.bookingDetails === undefined) update.bookingDetails = {};
//       if (pref.contactInfo === undefined) update.contactInfo = {};

//       // Perform update if there's something to patch
//       if (Object.keys(update).length > 0) {
//         await Preference.updateOne({ _id: pref._id }, { $set: update });
//         updatedCount++;
//       }
//     }

//     console.log(`✅ Backfill complete. ${updatedCount} preferences updated.`);
//     process.exit(0);
//   } catch (err) {
//     console.error("❌ Backfill failed:", err);
//     process.exit(1);
//   }
// };

// run();
