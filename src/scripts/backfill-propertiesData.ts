// import "dotenv/config";
// import mongoose from "mongoose";
// import { DB } from "../controllers"; // adjust path if needed

// const run = async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URL!);
//     console.log("✅ Connected to MongoDB");

//     const Property = DB.Models.Property;
//     const properties = await Property.find({});
//     let updatedCount = 0;

//     for (const prop of properties) {
//       const update: any = {};

//       if (prop.propertyCategory && typeof prop.propertyCategory === "string") {
//         const firstChar = prop.propertyCategory.charAt(0).toLowerCase();
//         const rest = prop.propertyCategory.slice(1);
//         const newCategory = firstChar + rest;

//         if (newCategory !== prop.propertyCategory) {
//           update.propertyCategory = newCategory;
//         }
//       }

//       // ✅ Perform update if needed
//       if (Object.keys(update).length > 0) {
//         await Property.updateOne({ _id: prop._id }, { $set: update });
//         updatedCount++;
//       }
//     }

//     console.log(`✅ Backfill complete. ${updatedCount} properties updated.`);
//     process.exit(0);
//   } catch (err) {
//     console.error("❌ Backfill failed:", err);
//     process.exit(1);
//   }
// };

// run();
