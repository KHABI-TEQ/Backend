// import "dotenv/config";
// import mongoose from "mongoose";
// import { DB } from "../controllers"; // Adjust path if needed

// // Import the new Preference interface and schema definitions
// // It's crucial that '../models/Preference' now exports the *new* schema
// import {
//   IPreference,
//   ILocation,
//   IBudget,
//   IPropertyDetails,
//   IDevelopmentDetails,
//   IBookingDetails,
//   IFeatures,
//   IContactInfo,
//   IGeneralContactInfo,
//   IJVContactInfo,
//   IShortletContactInfo,
// } from "../models/preference"; // Ensure this path points to your updated model file


// /**
//  * Helper function for deep comparison of objects (simplified version).
//  * Used to prevent unnecessary updates if data already matches target structure.
//  * Handles primitive types, arrays, and plain objects. Does not handle Dates, RegExps, etc.
//  */
// function deepEqual(obj1: any, obj2: any): boolean {
//   if (obj1 === obj2) return true;

//   if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) {
//     return false;
//   }

//   const keys1 = Object.keys(obj1);
//   const keys2 = Object.keys(obj2);

//   if (keys1.length !== keys2.length) return false;

//   for (const key of keys1) {
//     if (!keys2.includes(key) || !deepEqual(obj1[key], obj2[key])) {
//       return false;
//     }
//   }

//   return true;
// }

// const runMigration = async () => {
//   try {
//     // Connect to MongoDB using the URL from environment variables
//     await mongoose.connect(process.env.MONGO_URL!);
//     console.log("✅ Connected to MongoDB");

//     // Get the Mongoose model for Preference.
//     // IMPORTANT: Ensure your DB.Models.Preference refers to the *newly updated* schema.
//     const Preference = DB.Models.Preference;

//     // Fetch all existing preference documents
//     const preferences = await Preference.find({});
//     let updatedCount = 0;

//     console.log(`Found ${preferences.length} preferences to review for migration.`);

//     // Iterate through each preference document
//     for (const pref of preferences) {
//       // Convert Mongoose document to a plain JavaScript object to easily access old fields
//       const oldPref: any = pref.toObject();
//       const updateSet: any = {}; // Fields to set or update
//       const updateUnset: any = {}; // Fields to unset (remove)

//       let needsUpdate = false; // Flag to track if the document needs modification

//       // --- 1. Migrate Top-Level Primitives and required fields ---
//       // These fields exist in both old and new schemas, but might need default values
//       if (oldPref.preferenceType === undefined || oldPref.preferenceType === null) {
//         updateSet.preferenceType = "buy";
//         needsUpdate = true;
//       }
//       if (oldPref.preferenceMode === undefined || oldPref.preferenceMode === null) {
//         updateSet.preferenceMode = "buy";
//         needsUpdate = true;
//       }
//       if (oldPref.status === undefined || oldPref.status === null) {
//         updateSet.status = "pending";
//         needsUpdate = true;
//       }

//       // --- 2. Migrate Location ---
//       const newLocation: ILocation = {
//         state: "", // Default required state
//         localGovernmentAreas: [],
//         lgasWithAreas: [],
//         customLocation: "",
//       };

//       if (oldPref.location && typeof oldPref.location === "object") {
//         if (oldPref.location.state !== undefined && oldPref.location.state !== null) {
//           newLocation.state = oldPref.location.state;
//         }
//         if (Array.isArray(oldPref.location.localGovernmentAreas)) {
//           newLocation.localGovernmentAreas = oldPref.location.localGovernmentAreas;
//         }
//         if (Array.isArray(oldPref.location.lgasWithAreas)) {
//           newLocation.lgasWithAreas = oldPref.location.lgasWithAreas;
//         }
//         if (oldPref.location.customLocation !== undefined && oldPref.location.customLocation !== null) {
//           newLocation.customLocation = oldPref.location.customLocation;
//         }
//       }
//       // Only update if the current location in DB doesn't match the desired new structure
//       if (!deepEqual(oldPref.location || {}, newLocation)) {
//         updateSet.location = newLocation;
//         needsUpdate = true;
//       }

//       // --- 3. Migrate Budget ---
//       const newBudget: IBudget = {
//         currency: (oldPref.currency !== undefined && oldPref.currency !== null) ? oldPref.currency : "NGN", // Default required currency
//       };
//       if (oldPref.budgetMin !== undefined && oldPref.budgetMin !== null) {
//         newBudget.minPrice = oldPref.budgetMin;
//       }
//       if (oldPref.budgetMax !== undefined && oldPref.budgetMax !== null) {
//         newBudget.maxPrice = oldPref.budgetMax;
//       }

//       // Check if current budget structure is different or if old top-level fields exist
//       if (!deepEqual(oldPref.budget || {}, newBudget) ||
//           oldPref.budgetMin !== undefined || oldPref.budgetMax !== undefined || oldPref.currency !== undefined) {
//         updateSet.budget = newBudget;
//         // Unset old top-level budget fields
//         updateUnset.budgetMin = "";
//         updateUnset.budgetMax = "";
//         updateUnset.currency = "";
//         needsUpdate = true;
//       }

//       // --- 4. Migrate Features (Revised Logic for Conflict Resolution) ---
//       const newFeaturesData: IFeatures = {
//         baseFeatures: [],
//         premiumFeatures: [],
//         autoAdjustToFeatures: false, // Default value as required
//       };

//       const currentFeaturesIsArray = Array.isArray(oldPref.features);
//       const currentFeaturesIsObject = oldPref.features && typeof oldPref.features === 'object' && !currentFeaturesIsArray;

//       // Populate newFeaturesData based on existing data
//       if (currentFeaturesIsArray) {
//         newFeaturesData.baseFeatures = oldPref.features;
//       } else if (currentFeaturesIsObject) {
//         if (Array.isArray(oldPref.features.baseFeatures)) {
//           newFeaturesData.baseFeatures = oldPref.features.baseFeatures;
//         }
//         if (Array.isArray(oldPref.features.premiumFeatures)) {
//           newFeaturesData.premiumFeatures = oldPref.features.premiumFeatures;
//         }
//         if (typeof oldPref.features.autoAdjustToFeatures === 'boolean') {
//           newFeaturesData.autoAdjustToFeatures = oldPref.features.autoAdjustToFeatures;
//         }
//       }

//       // Check if current features in DB (converted to equivalent object) differs from desired newFeaturesData
//       const currentFeaturesEquivalent = currentFeaturesIsObject
//         ? oldPref.features
//         : (currentFeaturesIsArray ? { baseFeatures: oldPref.features, premiumFeatures: [], autoAdjustToFeatures: false } : {});

//       let featuresFieldNeedsUpdate = false;
//       if (!deepEqual(currentFeaturesEquivalent, newFeaturesData)) {
//           featuresFieldNeedsUpdate = true;
//       }

//       if (featuresFieldNeedsUpdate) {
//           // If the existing 'features' field is an array, we must unset it first.
//           // This must be a separate atomic operation to avoid the conflict.
//           if (currentFeaturesIsArray) {
//               console.log(`  -> Document ${oldPref._id}: Unsetting old 'features' array...`);
//               await Preference.updateOne({ _id: oldPref._id }, { $unset: { features: "" } });
//               // Note: updatedCount is not incremented here yet, as the actual data transformation
//               // (setting the new object) happens in the next main update.
//           }
//           updateSet.features = newFeaturesData; // Add the new object structure to the main update
//           needsUpdate = true; // Mark the document for a final update
//       }

//       // Ensure that 'features' is NOT in updateUnset for the final compound update,
//       // as its handling is explicit (unset separately or directly overwritten by $set).
//       delete updateUnset.features;


//       // --- 5. Migrate Property/Development/Booking Details ---
//       // These fields were 'any', so we need to preserve existing data within them
//       // and potentially move old top-level landSize/measurementType/documents into them.

//       // Common fields to move into details if they were top-level in the old schema
//       const commonDetailsData = {
//         // Convert old number type landSize to string for new schema
//         landSize: (oldPref.landSize !== undefined && oldPref.landSize !== null) ? String(oldPref.landSize) : undefined,
//         // Rename measurementType to measurementUnit and ensure string type
//         measurementUnit: (oldPref.measurementType !== undefined && oldPref.measurementType !== null) ? String(oldPref.measurementType) : undefined,
//         // Rename documents to documentTypes and ensure it's an array
//         documentTypes: Array.isArray(oldPref.documents) ? oldPref.documents : undefined,
//       };

//       // Handle specific detail types based on preferenceType
//       if (oldPref.preferenceType === "buy" || oldPref.preferenceType === "rent") {
//         const oldDetails = oldPref.propertyDetails || {};
//         const newPropertyDetails: IPropertyDetails = {
//           ...oldDetails, // Preserve existing data within old propertyDetails
//           ...commonDetailsData, // Add common details data if they were top-level
//         };

//         // Ensure required 'propertyType' is not undefined if propertyDetails exists.
//         if (newPropertyDetails.propertyType === undefined || newPropertyDetails.propertyType === null) {
//           newPropertyDetails.propertyType = ""; // Default to empty string if missing
//         }

//         if (!deepEqual(oldPref.propertyDetails || {}, newPropertyDetails) ||
//             oldPref.landSize !== undefined || oldPref.measurementType !== undefined || oldPref.documents !== undefined) {
//           updateSet.propertyDetails = newPropertyDetails;
//           needsUpdate = true;
//         }

//       } else if (oldPref.preferenceType === "joint-venture") {
//         const oldDetails = oldPref.developmentDetails || {};
//         const newDevelopmentDetails: IDevelopmentDetails = {
//           ...oldDetails, // Preserve existing data
//           ...commonDetailsData, // Add common details data
//         };

//         if (!deepEqual(oldPref.developmentDetails || {}, newDevelopmentDetails) ||
//             oldPref.landSize !== undefined || oldPref.measurementType !== undefined || oldPref.documents !== undefined) {
//           updateSet.developmentDetails = newDevelopmentDetails;
//           needsUpdate = true;
//         }
//         // Also migrate partnerExpectations, which is specific to JV
//         if (oldPref.partnerExpectations !== undefined && oldPref.partnerExpectations !== null) {
//             updateSet.partnerExpectations = oldPref.partnerExpectations;
//             needsUpdate = true;
//         } else if (oldPref.partnerExpectations === undefined && pref.partnerExpectations !== undefined && pref.partnerExpectations !== null) {
//             // Handle case where field exists but was null/undefined in oldPref
//             updateSet.partnerExpectations = pref.partnerExpectations;
//             needsUpdate = true;
//         } else if (updateSet.partnerExpectations === undefined) {
//             updateSet.partnerExpectations = ""; // Default if not present
//             needsUpdate = true;
//         }


//       } else if (oldPref.preferenceType === "shortlet") {
//         const oldDetails = oldPref.bookingDetails || {};
//         const newBookingDetails: IBookingDetails = {
//           ...oldDetails, // Preserve existing data
//           ...commonDetailsData, // Add common details data
//         };

//         if (!deepEqual(oldPref.bookingDetails || {}, newBookingDetails) ||
//             oldPref.landSize !== undefined || oldPref.measurementType !== undefined || oldPref.documents !== undefined) {
//           updateSet.bookingDetails = newBookingDetails;
//           needsUpdate = true;
//         }
//       }

//       // Unset old top-level fields that are now nested within details
//       if (oldPref.landSize !== undefined) updateUnset.landSize = "";
//       if (oldPref.measurementType !== undefined) updateUnset.measurementType = "";
//       if (oldPref.documents !== undefined) updateUnset.documents = "";


//       // --- 6. Migrate Contact Info ---
//       // Start with existing contact info, as it was a Mixed type
//       const newContactInfo: any = oldPref.contactInfo || {};

//       // Ensure required fields for IGeneralContactInfo are present
//       if (newContactInfo.fullName === undefined || newContactInfo.fullName === null) newContactInfo.fullName = "";
//       if (newContactInfo.email === undefined || newContactInfo.email === null) newContactInfo.email = "";
//       if (newContactInfo.phoneNumber === undefined || newContactInfo.phoneNumber === null) newContactInfo.phoneNumber = "";

//       // Add specific fields for Joint Venture contact info
//       if (oldPref.preferenceType === "joint-venture") {
//         if (newContactInfo.companyName === undefined || newContactInfo.companyName === null) newContactInfo.companyName = "";
//         if (newContactInfo.contactPerson === undefined || newContactInfo.contactPerson === null) newContactInfo.contactPerson = "";
//         if (newContactInfo.cacRegistrationNumber === undefined || newContactInfo.cacRegistrationNumber === null) newContactInfo.cacRegistrationNumber = "";
//       }
//       // Add specific fields for Shortlet contact info
//       else if (oldPref.preferenceType === "shortlet") {
//         if (newContactInfo.petsAllowed === undefined || newContactInfo.petsAllowed === null) newContactInfo.petsAllowed = false;
//         if (newContactInfo.smokingAllowed === undefined || newContactInfo.smokingAllowed === null) newContactInfo.smokingAllowed = false;
//         if (newContactInfo.partiesAllowed === undefined || newContactInfo.partiesAllowed === null) newContactInfo.partiesAllowed = false;
//         if (newContactInfo.additionalRequests === undefined || newContactInfo.additionalRequests === null) newContactInfo.additionalRequests = "";
//         if (newContactInfo.maxBudgetPerNight === undefined || newContactInfo.maxBudgetPerNight === null) newContactInfo.maxBudgetPerNight = 0;
//         if (newContactInfo.willingToPayExtra === undefined || newContactInfo.willingToPayExtra === null) newContactInfo.willingToPayExtra = false;
//         if (newContactInfo.cleaningFeeBudget === undefined || newContactInfo.cleaningFeeBudget === null) newContactInfo.cleaningFeeBudget = 0;
//         if (newContactInfo.securityDepositBudget === undefined || newContactInfo.securityDepositBudget === null) newContactInfo.securityDepositBudget = 0;
//         if (newContactInfo.cancellationPolicy === undefined || newContactInfo.cancellationPolicy === null) newContactInfo.cancellationPolicy = "";
//         if (newContactInfo.preferredCheckInTime === undefined || newContactInfo.preferredCheckInTime === null) newContactInfo.preferredCheckInTime = "";
//         if (newContactInfo.preferredCheckOutTime === undefined || newContactInfo.preferredCheckOutTime === null) newContactInfo.preferredCheckOutTime = "";
//       }

//       // Update if the current contactInfo structure is different
//       if (!deepEqual(oldPref.contactInfo || {}, newContactInfo)) {
//         updateSet.contactInfo = newContactInfo;
//         needsUpdate = true;
//       }

//       // --- 7. Migrate nearbyLandmark and additionalInfo/additionalNotes ---
//       if (oldPref.nearbyLandmark !== undefined && oldPref.nearbyLandmark !== null) {
//         updateSet.nearbyLandmark = oldPref.nearbyLandmark;
//       } else if (updateSet.nearbyLandmark === undefined) { // Only set default if not already set or existing
//          updateSet.nearbyLandmark = "";
//       }
//       // Check if `additionalInfo` (old name) exists
//       if (oldPref.additionalInfo !== undefined && oldPref.additionalInfo !== null) {
//         updateSet.additionalNotes = oldPref.additionalInfo; // Move to new name
//         updateUnset.additionalInfo = ""; // Remove old field
//         needsUpdate = true;
//       } else if (updateSet.additionalNotes === undefined) { // Only set default if not already set or existing
//         updateSet.additionalNotes = "";
//       }

//       // --- Perform Update if changes were detected ---
//       if (needsUpdate) {
//         const finalUpdate: any = {};
//         if (Object.keys(updateSet).length > 0) {
//           finalUpdate.$set = updateSet;
//         }
//         if (Object.keys(updateUnset).length > 0) {
//           finalUpdate.$unset = updateUnset;
//         }

//         if (Object.keys(finalUpdate).length > 0) {
//           await Preference.updateOne({ _id: oldPref._id }, finalUpdate);
//           updatedCount++; // Increment count only for the final, consolidated update
//         }
//       }
//     }

//     console.log(`✅ Backfill complete. ${updatedCount} preferences updated.`);
//     process.exit(0); // Exit successfully
//   } catch (err) {
//     console.error("❌ Backfill failed:", err);
//     process.exit(1); // Exit with an error code
//   } finally {
//     await mongoose.disconnect(); // Ensure disconnection
//     console.log("MongoDB disconnected.");
//   }
// };

// runMigration();
