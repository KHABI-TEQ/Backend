// import "dotenv/config";
// import mongoose from "mongoose";
// import { DB } from "../controllers"; // adjust path to your DB export

// const run = async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URL!);
//     console.log("✅ Connected to MongoDB");

//     const planFeatureModel = DB.Models.PlanFeature;

//     // Deduplicated subscription features
//     const features = [
//       { key: "LISTINGS", label: "Listings", isActive: true },
//       { key: "AGENT_MARKETPLACE", label: "Agent Marketplace Matches & Submissions", isActive: true },
//       { key: "PUBLIC_PROFILE_PAGE", label: "Public Agent Profile Page", isActive: true },
//       { key: "VERIFIED_BADGE", label: "Verified Badge", isActive: true },
//       { key: "AUTOMATIC_PUSHUP", label: "Automatic Push-Up (listings refreshed)", isActive: true },
//       { key: "NEGOTIATION_INSPECTION_TOOLS", label: "Negotiation & Inspection Tools", isActive: true },
//       { key: "SOCIAL_MEDIA_ADS", label: "Social Media Advertising Support", isActive: true },
//       { key: "SET_INSPECTION_FEE", label: "Set Your Own Inspection Fee", isActive: true },
//       { key: "NO_COMMISSION_FEES", label: "No Commission Fees", isActive: true },
//       { key: "PUBLIC_PROFILE_PAGE_EXTAL_DATA", label: "Public Agent Profile Page (reviews, achievements, shareable link)", isActive: true },
//     ];

//     let insertedCount = 0;

//     for (const f of features) {
//       const exists = await planFeatureModel.findOne({ key: f.key });
//       if (!exists) {
//         await planFeatureModel.create(f);
//         insertedCount++;
//       }
//     }

//     console.log(`✅ Inserted ${insertedCount} new plan features.`);
//     process.exit(0);
//   } catch (err) {
//     console.error("❌ Failed to insert plan features:", err);
//     process.exit(1);
//   }
// };

// run();
