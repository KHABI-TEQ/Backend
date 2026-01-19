import express from "express";
import AdminInspRouter from "./admin.inspections";
import multer from "multer";
import { adminAuth } from "../middlewares/adminAuth";
import { loginAdmin } from "../controllers/Admin/Auth/loginAdmin";
import { changeAdminPassword, getAdminProfile, updateAdminProfile } from "../controllers/Admin/profileSettings";
import { changeAdminStatus, createAdmin, deleteAdmin, getAdmins, getSingleAdmin, updateAdmin } from "../controllers/Admin/Account/admins";
import { approveAgentKYCData, deleteAgentAccount, flagOrUnflagAgentAccount, getAgentDashboardStatistics, getAgents, getAgentsByType, getAllAgentProperties, getAllAgents, getAllAgentUpgradeRequests, getSingleAgentProfile, toggleAgentStatus } from "../controllers/Admin/Account/agents";
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
import { deleteTransactionDetails, getAllTransactions, getTransactionById, getTransactionStats, validateTransaction } from "../controllers/Admin/Transaction/adminTransaction";
import { bulkUpsertSettings, createSetting, deleteSetting, getAllSettings, getSetting, updateSetting } from "../controllers/Admin/Settings/mySettings";
import { createPlanFeature, createSubscriptionPlan, deletePlanFeature, deleteSubscriptionPlan, getAllPlanFeatures, getAllSubscriptionPlans, getPlanFeature, getSubscriptionPlan, updatePlanFeature, updateSubscriptionPlan } from "../controllers/Admin/Settings/subscriptionPlansActionController";
import { cancelSubscription, fetchUserSubscriptions, getSubscriptionDetails, updateSubscription } from "../controllers/Admin/Settings/subscriptionActionController";
import { deletePreference } from "../controllers/Admin/preference/deletePreference";
import { adminActivateDealSite, adminGetAllDealSites, adminGetDealSiteActivities, adminGetDealSiteBySlug, adminGetDealSiteReports, adminGetDealSiteStats, adminPauseDealSite, adminPutOnHoldDealSite } from "../controllers/Admin/DealSite/adminDealSite";
import { deleteReferral, fetchAllReferrals, getReferralDetails, getReferralStats, updateReferral } from "../controllers/Admin/ExtralPages/referralLogs";
import { adminAddSubscription, adminChangeSubscriptionStatus, adminDeleteSubscription, adminGetAllSubscriptions } from "../controllers/Admin/Settings/emailSubscriptionActionController";
import { adminCreatePromotion, adminDeletePromotion, adminGetPromotionAnalytics, adminGetPromotionById, adminListPromotions, adminUpdatePromotion, adminUpdatePromotionStatus } from "../controllers/Admin/Campaign/adminPromotionController";
import { DashboardStatsController } from "../controllers/Admin/Dashboard/DashboardStatsController";
import { PERMISSIONS } from "../common/constants/permissions";
import { requirePermission, requireSuperAdmin } from "../middlewares/authorizationMiddleware";
import { assignPermissionsToAdmin, assignRolesToAdmin, createPermission, createRole, deletePermission, deleteRole, getAdminRolesAndPermissions, getAllPermissions, getAllRoles, getPermissionById, getRoleById, seedDefaultPermissions, seedDefaultRoles, updatePermission, updateRole } from "../controllers/Admin/Permission/rolePermissionController";


const storage = multer.memoryStorage();
const upload = multer({ storage });

const AdminRouter = express.Router();

const dashboardController = new DashboardStatsController();

 
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


AdminRouter.get("/stats", dashboardController.getStats);

AdminRouter.get("/getStatsBy/:statsType", dashboardController.getStatsByType);

/**
 * @route   GET /api/dashboard/stats/overview
 * @desc    Get overview statistics only
 * @access  Protected (Admin)
 * @query   filter: 7days | 30days | 365days | range
 */
AdminRouter.get("/stats/overview", dashboardController.getOverview);


/**
 * @route   GET /api/dashboard/stats/export
 * @desc    Export dashboard statistics
 * @access  Protected (Admin)
 * @query   filter: 7days | 30days | 365days | range
 * @query   format: json | csv
 */
AdminRouter.get("/stats/export", dashboardController.exportData);

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
AdminRouter.get("/agents/fetchAll/:type", getAgentsByType);
AdminRouter.get("/agents/dashboard", getAgentDashboardStatistics);
AdminRouter.post("/agents/:userId/reviewKycRequest", approveAgentKYCData);

AdminRouter.get("/agents/upgrade-requests", getAllAgentUpgradeRequests);

AdminRouter.get("/agents/:userId", getSingleAgentProfile);
AdminRouter.post("/agents/:userId/status", toggleAgentStatus);
AdminRouter.delete("/agents/:userId/delete", deleteAgentAccount);
AdminRouter.put("/agents/:userId/flag-account", flagOrUnflagAgentAccount);
AdminRouter.get("/agents/:userId/allProperties", getAllAgentProperties);

 
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
AdminRouter.post("/preferences/:preferenceId/reject", rejectPreference);
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
AdminRouter.get("/transactions/stats", getTransactionStats);
AdminRouter.get("/transactions/:transactionId", getTransactionById);
AdminRouter.delete("/transactions/:transactionId", deleteTransactionDetails);
AdminRouter.post("/transactions/:transactionId/manaualVerification", validateTransaction);

// DEAL SITE MANAGEMENT ROUTES
AdminRouter.get("/deal-sites/getAll", adminGetAllDealSites);
AdminRouter.get("/deal-sites/stats", adminGetDealSiteStats);
AdminRouter.get("/deal-sites/:publicSlug", adminGetDealSiteBySlug);
AdminRouter.get("/deal-sites/:publicSlug/reports", adminGetDealSiteReports);
AdminRouter.get("/deal-sites/:publicSlug/logs", adminGetDealSiteActivities);
AdminRouter.put("/deal-sites/:publicSlug/pause", adminPauseDealSite);
AdminRouter.put("/deal-sites/:publicSlug/putOnHold", adminPutOnHoldDealSite);
AdminRouter.put("/deal-sites/:publicSlug/resume", adminActivateDealSite);
 
// SUBSCRIPTION FEATURES MANAGEMENT ROUTES
AdminRouter.post("/subscription-features/createNew", createPlanFeature);
AdminRouter.put("/subscription-features/:featureId/update", updatePlanFeature);
AdminRouter.delete("/subscription-features/:featureId/deleteOne", deletePlanFeature);
AdminRouter.get("/subscription-features/getAll", getAllPlanFeatures);
AdminRouter.get("/subscription-features/:featureId/getOne", getPlanFeature);

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

// PROMOTION MANAGEMENT ROUTES
AdminRouter.post("/promotions/create", adminCreatePromotion);
AdminRouter.get("/promotions/getAll", adminListPromotions);
AdminRouter.get("/promotions/:id/getOne", adminGetPromotionById);
AdminRouter.get("/promotions/:id/analytics", adminGetPromotionAnalytics);
AdminRouter.patch("/promotions/:id/edit", adminUpdatePromotion);
AdminRouter.patch("/promotions/:id/status", adminUpdatePromotionStatus);
AdminRouter.delete("/promotions/:id/delete", adminDeletePromotion);

// EMAIL SUBSCRIPTION MANAGEMENT ROUTES
AdminRouter.get("/emailSubscriptions/getAll", adminGetAllSubscriptions);
AdminRouter.post("/emailSubscriptions/addNew", adminAddSubscription);
AdminRouter.delete("/emailSubscriptions/:subscriptionId/delete", adminDeleteSubscription);
AdminRouter.put("/emailSubscriptions/:subscriptionId/changeStatus", adminChangeSubscriptionStatus);

// REFERRAL MANAGEMENT ROUTES
AdminRouter.get("/referrals/getAll", fetchAllReferrals);
AdminRouter.get("/referrals/stats", getReferralStats);
AdminRouter.get("/referrals/:referralId", getReferralDetails);
AdminRouter.put("/referrals/:referralId/update", updateReferral);
AdminRouter.delete("/referrals/:referralId/delete", deleteReferral);

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





/**
 * GET /api/permissions
 * Get all permissions with optional filtering by category, isActive, or search
 * Query params: category, isActive, search
 */
// AdminRouter.get('/permissions', requirePermission(PERMISSIONS.ADMINS_MANAGE_PERMISSIONS), getAllPermissions);
AdminRouter.get('/permissions', getAllPermissions);

/**
 * GET /api/permissions/:id
 * Get a single permission by ID
 */
// AdminRouter.get('/permissions/:id', requirePermission(PERMISSIONS.ADMINS_MANAGE_PERMISSIONS), getPermissionById);
AdminRouter.get('/permissions/:id', getPermissionById);

/**
 * POST /api/permissions
 * Create a new permission
 * Body: { name, description, resource, action, category, isActive? }
 */
// AdminRouter.post('/permissions', requireSuperAdmin, createPermission);
AdminRouter.post('/permissions', createPermission);

/**
 * PUT /api/permissions/:id
 * Update a permission
 * Body: { name?, description?, isActive? }
 */
// AdminRouter.put('/permissions/:id', requireSuperAdmin, updatePermission);
AdminRouter.put('/permissions/:id', updatePermission);

/**
 * DELETE /api/permissions/:id
 * Delete a permission (only if not used in any roles)
 */
// AdminRouter.delete('/permissions/:id', requireSuperAdmin, deletePermission);
AdminRouter.delete('/permissions/:id', deletePermission);

/**
 * POST /api/permissions/seed
 * Seed default permissions from constants
 * Only works if no permissions exist yet
 */
// AdminRouter.post('/permissions/seed', requireSuperAdmin, seedDefaultPermissions);
AdminRouter.post('/permissions/seed', seedDefaultPermissions);

// ==================== ROLE ROUTES ====================

/**
 * GET /api/roles
 * Get all roles with optional filtering
 * Query params: isActive, search
 */
// AdminRouter.get('/roles', requirePermission(PERMISSIONS.ADMINS_MANAGE_PERMISSIONS), getAllRoles);
AdminRouter.get('/roles', getAllRoles);

/**
 * GET /api/roles/:id
 * Get a single role by ID
 */
// AdminRouter.get('/roles/:id', requirePermission(PERMISSIONS.ADMINS_MANAGE_PERMISSIONS), getRoleById);
AdminRouter.get('/roles/:id', getRoleById);

/**
 * POST /api/roles
 * Create a new role
 * Body: { name, description, permissions[], level, isActive? }
 */
// AdminRouter.post('/roles', requireSuperAdmin, createRole);
AdminRouter.post('/roles', createRole);

/**
 * PUT /api/roles/:id
 * Update a role
 * Body: { name?, description?, permissions[]?, level?, isActive? }
 */
// AdminRouter.put('/roles/:id', requireSuperAdmin, updateRole);
AdminRouter.put('/roles/:id', updateRole);

/**
 * DELETE /api/roles/:id
 * Delete a role (only if not assigned to any admins)
 */
// AdminRouter.delete('/roles/:id', requireSuperAdmin, deleteRole);
AdminRouter.delete('/roles/:id', deleteRole);

/**
 * POST /api/roles/seed
 * Seed default roles from constants
 * Only works if no roles exist yet
 */
// AdminRouter.post('/roles/seed', requireSuperAdmin, seedDefaultRoles);
AdminRouter.post('/roles/seed', seedDefaultRoles);

// ==================== ADMIN ROLE ASSIGNMENT ROUTES ====================

/**
 * GET /api/admins/:adminId/roles-and-permissions
 * Get admin's assigned roles and permissions
 */
AdminRouter.get(
  '/admins/:adminId/roles-and-permissions',
  requirePermission(PERMISSIONS.ADMINS_VIEW),
  getAdminRolesAndPermissions
);

/**
 * POST /api/admins/:adminId/roles
 * Assign roles to an admin
 * Body: { roles: string[] }
 */
AdminRouter.post(
  '/admins/:adminId/roles',
  requirePermission(PERMISSIONS.ADMINS_ASSIGN_ROLES),
  assignRolesToAdmin
);

/**
 * POST /api/admins/:adminId/permissions
 * Assign permissions to an admin
 * Body: { permissions: string[], mode?: 'set' | 'add' | 'remove' }
 */
AdminRouter.post(
  '/admins/:adminId/permissions',
  requirePermission(PERMISSIONS.ADMINS_MANAGE_PERMISSIONS),
  assignPermissionsToAdmin
);

AdminRouter.use(AdminInspRouter);

export default AdminRouter;
