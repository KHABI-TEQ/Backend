import express from "express";
import AdminInspRouter from "./admin.inspections";
import multer from "multer";
import { adminAuth } from "../middlewares/adminAuth";
import { loginAdmin } from "../controllers/Admin/Auth/loginAdmin";
import { changeAdminPassword, getAdminProfile, updateAdminProfile } from "../controllers/Admin/profileSettings";
import { changeAdminStatus, createAdmin, deleteAdmin, getAdmins, getSingleAdmin, updateAdmin } from "../controllers/Admin/Account/admins";
import { approveAgentOnboardingStatus, deleteAgentAccount, flagOrUnflagAgentAccount, getAgentDashboardStatistics, getAgents, getAllAgentProperties, getAllAgents, getAllAgentUpgradeRequests, getSingleAgentProfile, toggleAgentStatus } from "../controllers/Admin/Account/agents";
import { deleteLandlordAction, flagOrUnflagLandownerAccount, getAllLandlordProperties, getAllLandlords, getLandlordDashboardStatistics, getSingleLandlord } from "../controllers/Admin/Account/landlords";
import { getPreferenceModeStats, getPreferencesByMode, getSinglePreference } from "../controllers/Admin/preference/fetchPreference";
import { findMatchedProperties } from "../controllers/Admin/preference/findMatchProerty";
import { selectMatchedPreferenceProperties } from "../controllers/Admin/preference/submitMatchedProperties";
import { setPropertyApprovalStatus } from "../controllers/Admin/Property/setPropertyApprovalStatus";
import { getAllProperties, getPropertyInspections, getPropertyStats, getSinglePropertyDetails } from "../controllers/Admin/Property/fetchProperties";
import { updatePropertyStatusAsAdmin } from "../controllers/Admin/Property/updatePropertyStatus";
import { approvePreference } from "../controllers/Admin/preference/approvePreference";
import { createTestimonial, deleteTestimonial, getAllTestimonials, getLatestApprovedTestimonials, getTestimonial, updateTestimonial, updateTestimonialStatus } from "../controllers/Admin/ExtralPages/testimonials";
import { createBuyer, deleteBuyer, getAllBuyers, getBuyerPreferences, getSingleBuyer, updateBuyer } from "../controllers/Admin/Account/buyers";
import { rejectPreference } from "../controllers/Admin/preference/rejectPreference";
import { deleteVerifyDoc, fetchAllVerifyDocs, fetchSingleVerifyDoc, fetchVerifyDocStats } from "../controllers/Admin/DocumentVerification/fetchVerifyDocument";
import { adminDocumentVerification, sendToVerificationProvider } from "../controllers/Admin/DocumentVerification/DocumentVerificationUploader";
import { editPropertyAsAdmin } from "../controllers/Admin/Property/editProperty";
import { deletePropertyById } from "../controllers/Admin/Property/deleteProperty";
import { assignInspectionToFieldAgent, createFieldAgent, deleteFieldAgentAccount, flagOrUnflagFieldAgentAccount, getAllFieldAgents, getFieldAgentAssignedInspections, getFieldAgentDashboardStatistics, getSingleFieldAgentProfile, toggleFieldAgentStatus, updateFieldAgent } from "../controllers/Admin/Account/fieldAgent";
import { validateJoi } from "../middlewares/validateJoi";
import { createFieldAgentSchema } from "../validators/fieldAgent.validator";
import { deleteFileFromCloudinary, uploadFileToCloudinary } from "../controllers/General/UploadFileController";
import { deleteTransactionDetails, getAllTransactions, getTransactionById, validateTransaction } from "../controllers/Admin/Transaction/adminTransaction";
import { bulkUpsertSettings, createSetting, deleteSetting, getAllSettings, getSetting, updateSetting } from "../controllers/Admin/Settings/mySettings";
import { createSubscriptionPlan, deleteSubscriptionPlan, getAllSubscriptionPlans, getSubscriptionPlan, updateSubscriptionPlan } from "../controllers/Admin/Settings/subscriptionPlansActionController";
import { cancelSubscription, fetchUserSubscriptions, getSubscriptionDetails, updateSubscription } from "../controllers/Admin/Settings/subscriptionActionController";
import { deletePreference } from "../controllers/Admin/preference/deletePreference";

const storage = multer.memoryStorage();
const upload = multer({ storage });

const AdminRouter = express.Router();

 
// Allow login and create-admin without auth
AdminRouter.post("/login", loginAdmin);

AdminRouter.post(
  "/upload-single-file",
  upload.single("file"),
  uploadFileToCloudinary,
);

AdminRouter.delete("/delete-single-file", deleteFileFromCloudinary);



/**
 * **************************************************************************
 * **************************************************************************
 * ************************* AUTHTENTICATED ROUTES **************************
 * **************************************************************************
 * **************************************************************************
 */
AdminRouter.use(adminAuth);

/**
 * ADMIN PROFILE ROUTES
 */
AdminRouter.get("/profile", getAdminProfile);
AdminRouter.get("/profile/update", updateAdminProfile);
AdminRouter.post("/change-password", changeAdminPassword);

/**
 * ADMIN MANAGEMENT ROUTES
 */
AdminRouter.get("/admins/fetchAll", getAdmins);
AdminRouter.post("/admins/create", createAdmin);
AdminRouter.get("/admins/:adminId/getOne", getSingleAdmin);
AdminRouter.put("/admins/:adminId/update", updateAdmin);
AdminRouter.delete("/admins/:adminId/delete", deleteAdmin);
AdminRouter.patch("/admins/:adminId/status", changeAdminStatus);

/**
 * AGENTS MANAGEMENT ROUTES
 */
AdminRouter.get("/agents", getAllAgents);
AdminRouter.get("/agents/fetchAll", getAgents);
AdminRouter.get("/agents/dashboard", getAgentDashboardStatistics);
AdminRouter.get("/agents/upgrade-requests", getAllAgentUpgradeRequests);
AdminRouter.post("/agents/approve-agent", approveAgentOnboardingStatus);
AdminRouter.get("/agents/:userId", getSingleAgentProfile);
AdminRouter.post("/agents/:userId/status", toggleAgentStatus);
AdminRouter.delete("/agents/:userId/delete", deleteAgentAccount);
AdminRouter.put("/agents/:userId/flag-account", flagOrUnflagAgentAccount);
AdminRouter.put("/agents/:userId/allProperties", getAllAgentProperties);


// LANDOWNERS MANAGEMENT ROUTES
AdminRouter.get("/landowners", getAllLandlords);
AdminRouter.get("/landowners/:userId", getSingleLandlord);
AdminRouter.get("/landowners/dashboard", getLandlordDashboardStatistics);
AdminRouter.put("/landowners/:userId/flag-account", flagOrUnflagLandownerAccount);
AdminRouter.delete("/landowners/:userId/delete", deleteLandlordAction);
AdminRouter.put("/landowners/:userId/flag-account", flagOrUnflagLandownerAccount);
AdminRouter.get("/landowners/:userId/allProperties", getAllLandlordProperties);
 
 
AdminRouter.get("/field-agents", getAllFieldAgents);
AdminRouter.get("/field-agents/dashboard", getFieldAgentDashboardStatistics);
AdminRouter.post("/field-agents/assignInspection", assignInspectionToFieldAgent);
AdminRouter.post("/field-agents/create", validateJoi(createFieldAgentSchema), createFieldAgent);
AdminRouter.get("/field-agents/:userId", getSingleFieldAgentProfile);
AdminRouter.put("/field-agents/:userId/status", toggleFieldAgentStatus);
AdminRouter.delete("/field-agents/:userId/delete", deleteFieldAgentAccount);
AdminRouter.put("/field-agents/:userId/flag-account", flagOrUnflagFieldAgentAccount);
AdminRouter.put("/field-agents/:userId/update-account", updateFieldAgent);
AdminRouter.get("/field-agents/:userId/allAssignedInspections", getFieldAgentAssignedInspections);

 
// PREFERENCE MANAGEMENT ROUTES
// this is for "developers" or "tenants" or "shortlets" or "buyers"
AdminRouter.get("/preferences/:preferenceMode", getPreferencesByMode);
AdminRouter.get("/preferences/:preferenceMode/stats", getPreferenceModeStats);
AdminRouter.patch("/preferences/:preferenceId/approve", approvePreference);
AdminRouter.patch("/preferences/:preferenceId/reject", rejectPreference);
AdminRouter.get("/preferences/:preferenceId/withAllBuyerPreferences", getSinglePreference);
AdminRouter.get("/preferences/:preferenceId/findMatchesProperties", findMatchedProperties);
AdminRouter.delete("/preferences/:preferenceId/delete", deletePreference);
AdminRouter.post("/preferences/submitMatched", selectMatchedPreferenceProperties);
 

// PROPERTY MANAGEMENT ROUTES
AdminRouter.get("/properties/", getAllProperties);
AdminRouter.get("/properties/stats", getPropertyStats);
AdminRouter.get("/properties/:propertyId/getOne", getSinglePropertyDetails);
AdminRouter.patch("/properties/:propertyId/update", editPropertyAsAdmin);
AdminRouter.delete("/properties/:propertyId/delete", deletePropertyById);
AdminRouter.post("/properties/:propertyId/changeStatus", updatePropertyStatusAsAdmin);
AdminRouter.get("/properties/:propertyId/inspections", getPropertyInspections);
  

// TESTIMONIALS MANAGEMENT ROUTES
AdminRouter.get("/testimonials", getAllTestimonials);
AdminRouter.get("/testimonials/latestApproved", getLatestApprovedTestimonials);
AdminRouter.get("/testimonials/:testimonialId", getTestimonial);
AdminRouter.post("/testimonials/create", createTestimonial);
AdminRouter.put("/testimonials/:testimonialId/update", updateTestimonial);
AdminRouter.put("/testimonials/:testimonialId/updateStatus", updateTestimonialStatus);
AdminRouter.delete("/testimonials/:testimonialId/delete", deleteTestimonial);


// BUYERS MANAGEMENT ROUTES
AdminRouter.get("/buyers", getAllBuyers);
AdminRouter.get("/buyers/:buyerId", getSingleBuyer);
AdminRouter.post("/buyers/create", createBuyer);
AdminRouter.put("/buyers/:buyerId/update", updateBuyer);
AdminRouter.delete("/buyers/:buyerId/delete", deleteBuyer);
AdminRouter.get("/buyers/:buyerId/allPreferences", getBuyerPreferences);

// TRANSACTION MANAGEMENT ROUTES
AdminRouter.get("/transactions", getAllTransactions);
AdminRouter.get("/transactions/:transactionId", getTransactionById);
AdminRouter.delete("/transactions/:transactionId", deleteTransactionDetails);
AdminRouter.post("/transactions/:transactionId/manaualVerification", validateTransaction);

// SUBSCRIPTION PLANS MANAGEMENT ROUTES
AdminRouter.post("/subsription-plans/createNew", createSubscriptionPlan);
AdminRouter.put("/subsription-plans/:planId/update", updateSubscriptionPlan);
AdminRouter.delete("/subsription-plans/:planId/deleteOne", deleteSubscriptionPlan);
AdminRouter.get("/subsription-plans", getAllSubscriptionPlans);
AdminRouter.get("/subsription-plans/:planId/getOne", getSubscriptionPlan);

// SUBSCRIPTION PLANS MANAGEMENT ROUTES
AdminRouter.get("/subscriptions", fetchUserSubscriptions);
AdminRouter.get("/subscriptions/:subscriptionId", getSubscriptionDetails);
AdminRouter.put("/subscriptions/:subscriptionId", updateSubscription);
AdminRouter.post("/subscriptions/:subscriptionId", cancelSubscription);

// =======================DOCUMENT VERIFICATION FUNCTIONALITIES==================================
AdminRouter.get("/verification-docs", fetchAllVerifyDocs);
AdminRouter.get("/verification-docs/stats", fetchVerifyDocStats);
AdminRouter.get("/verification-doc/:documentId", fetchSingleVerifyDoc);
AdminRouter.delete("/verification-docs/:documentId", deleteVerifyDoc);
AdminRouter.post("/send-to-provider/:documentId", sendToVerificationProvider);
// self report verification
AdminRouter.post("/verification-docs/:documentId/uploadReport", adminDocumentVerification);


// SETTINGS ROUTES
AdminRouter.post("/settings/create", createSetting);
AdminRouter.post("/settings/bulkCreateOrUpdate", bulkUpsertSettings);
AdminRouter.put("/settings/:key/update", updateSetting);
AdminRouter.get("/settings/:key/getOne", getSetting);
AdminRouter.get("/settings/getAll", getAllSettings);
AdminRouter.delete("/settings/:key/delete", deleteSetting);

AdminRouter.use(AdminInspRouter);

export default AdminRouter;
