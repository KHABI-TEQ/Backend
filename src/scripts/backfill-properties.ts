// import "dotenv/config";
// import mongoose from "mongoose";
// import { DB } from "../controllers"; // Adjust if path differs

// const run = async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URL!);
//     console.log("✅ Connected to MongoDB");

//     const Property = DB.Models.Property;
//     const properties = await Property.find({});
//     let updatedCount = 0;

//     for (const prop of properties) {
//       const update: any = {};

//       // Top-level primitives
//       if (prop.propertyType === undefined) update.propertyType = "";
//       if (prop.propertyCategory === undefined) update.propertyCategory = "";
//       if (prop.propertyCondition === undefined) update.propertyCondition = "";
//       if (prop.typeOfBuilding === undefined) update.typeOfBuilding = "";
//       if (prop.rentalType === undefined) update.rentalType = "";
//       if (prop.shortletDuration === undefined) update.shortletDuration = "";
//       if (prop.holdDuration === undefined) update.holdDuration = "";
//       if (prop.price === undefined) update.price = 0;
//       if (prop.description === undefined) update.description = "";
//       if (prop.addtionalInfo === undefined) update.addtionalInfo = "";
//       if (prop.isTenanted === undefined) update.isTenanted = "no";
//       if (prop.isAvailable === undefined) update.isAvailable = false;
//       if (prop.briefType === undefined) update.briefType = "";
//       if (prop.isPremium === undefined) update.isPremium = false;
//       if (prop.isApproved === undefined) update.isApproved = false;
//       if (prop.isRejected === undefined) update.isRejected = false;
//       if (prop.isDeleted === undefined) update.isDeleted = false;
//       if (prop.status === undefined)
//         update.status = prop.isApproved ? "approved" : "pending";
//       if (prop.reason === undefined) update.reason = "";
//       if (prop.createdByRole === undefined) update.createdByRole = "user";
//       if (prop.areYouTheOwner === undefined) update.areYouTheOwner = false;

//       // Arrays
//       if (!Array.isArray(prop.features)) update.features = [];
//       if (!Array.isArray(prop.tenantCriteria)) update.tenantCriteria = [];
//       if (!Array.isArray(prop.docOnProperty)) update.docOnProperty = [];
//       if (!Array.isArray(prop.jvConditions)) update.jvConditions = [];
//       if (!Array.isArray(prop.pictures)) update.pictures = [];
//       if (!Array.isArray(prop.videos)) update.videos = [];

//       // Nested: location
//       if (!prop.location || typeof prop.location !== "object") {
//         update.location = {
//           state: "",
//           localGovernment: "",
//           area: "",
//         };
//       } else {
//         update.location = {
//           state: prop.location.state ?? "",
//           localGovernment: prop.location.localGovernment ?? "",
//           area: prop.location.area ?? "",
//         };
//       }

//       // Nested: landSize
//       if (!prop.landSize || typeof prop.landSize !== "object") {
//         update.landSize = {
//           measurementType: "",
//           size: 0,
//         };
//       } else {
//         update.landSize = {
//           measurementType: prop.landSize.measurementType ?? "",
//           size: prop.landSize.size ?? 0,
//         };
//       }

//       // Nested: additionalFeatures
//       if (
//         !prop.additionalFeatures ||
//         typeof prop.additionalFeatures !== "object"
//       ) {
//         update.additionalFeatures = {
//           noOfBedroom: 0,
//           noOfBathroom: 0,
//           noOfToilet: 0,
//           noOfCarPark: 0,
//         };
//       } else {
//         update.additionalFeatures = {
//           noOfBedroom: prop.additionalFeatures.noOfBedroom ?? 0,
//           noOfBathroom: prop.additionalFeatures.noOfBathroom ?? 0,
//           noOfToilet: prop.additionalFeatures.noOfToilet ?? 0,
//           noOfCarPark: prop.additionalFeatures.noOfCarPark ?? 0,
//         };
//       }

//       // Nested: shortletDetails
//       if (!prop.shortletDetails || typeof prop.shortletDetails !== "object") {
//         update.shortletDetails = {
//           streetAddress: "",
//           maxGuests: 0,
//           availability: { minStay: 0 },
//           pricing: { nightly: 0, weeklyDiscount: 0 },
//           houseRules: { checkIn: "", checkOut: "" },
//         };
//       } else {
//         update.shortletDetails = {
//           streetAddress: prop.shortletDetails.streetAddress ?? "",
//           maxGuests: prop.shortletDetails.maxGuests ?? 0,
//           availability: {
//             minStay: prop.shortletDetails.availability?.minStay ?? 0,
//           },
//           pricing: {
//             nightly: prop.shortletDetails.pricing?.nightly ?? 0,
//             weeklyDiscount: prop.shortletDetails.pricing?.weeklyDiscount ?? 0,
//           },
//           houseRules: {
//             checkIn: prop.shortletDetails.houseRules?.checkIn ?? "",
//             checkOut: prop.shortletDetails.houseRules?.checkOut ?? "",
//           },
//         };
//       }

//       // Perform update only if something to patch
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



// import "dotenv/config";
// import mongoose from "mongoose";
// import { DB } from "../controllers"; // adjust path if needed

// const run = async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URL!);
//     console.log("✅ Connected to MongoDB");

//     const Agent = DB.Models.Agent;
//     const agents = await Agent.find({});
//     let updatedCount = 0;

//     for (const agent of agents) {
//       const update: any = {};

//       // Backfill kycData
//       if (!agent.kycData || typeof agent.kycData !== "object") {
//         update.kycData = {
//           agentLicenseNumber: null,
//           profileBio: null,
//           specializations: [],
//           languagesSpoken: [],
//           servicesOffered: [],
//           achievements: [],
//           featuredListings: [],
//         };
//       } else {
//         update.kycData = {
//           agentLicenseNumber: agent.kycData.agentLicenseNumber ?? null,
//           profileBio: agent.kycData.profileBio ?? null,
//           specializations: agent.kycData.specializations ?? [],
//           languagesSpoken: agent.kycData.languagesSpoken ?? [],
//           servicesOffered: agent.kycData.servicesOffered ?? [],
//           achievements: agent.kycData.achievements ?? [],
//         };
//       }

//       // Backfill kycStatus
//       if (!agent.kycStatus) {
//         update.kycStatus = "none";
//       }

//       // Perform update only if something to patch
//       if (Object.keys(update).length > 0) {
//         await Agent.updateOne({ _id: agent._id }, { $set: update });
//         updatedCount++;
//       }
//     }

//     console.log(`✅ Backfill complete. ${updatedCount} agents updated.`);
//     process.exit(0);
//   } catch (err) {
//     console.error("❌ Backfill failed:", err);
//     process.exit(1);
//   }
// };

// run();
