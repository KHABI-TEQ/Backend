// import "dotenv/config";
// import mongoose from "mongoose";
// import { DB } from "../controllers"; // adjust path if needed

// const run = async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URL!);
//     console.log("✅ Connected to MongoDB");

//     const Preference = DB.Models.Preference;
//     const Buyer = DB.Models.Buyer;

//     const preferences = await Preference.find({ buyer: { $ne: null } }).select("_id buyer");

//     const invalidPreferenceIds: string[] = [];

//     for (const pref of preferences) {
//       const buyerExists = await Buyer.exists({ _id: pref.buyer });

//       if (!buyerExists) {
//         invalidPreferenceIds.push(pref._id.toString());
//       }
//     }

//     if (invalidPreferenceIds.length === 0) {
//       console.log("✅ No preferences found with invalid buyer references.");
//       return process.exit(0);
//     }

//     await Preference.deleteMany({ _id: { $in: invalidPreferenceIds } });

//     console.log(`✅ Deleted ${invalidPreferenceIds.length} preferences with missing buyers.`);
//     process.exit(0);
//   } catch (err) {
//     console.error("❌ Deletion failed:", err);
//     process.exit(1);
//   }
// };

// run();
