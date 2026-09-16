import express, { NextFunction, Response } from "express";
import { postProperty } from "../controllers/Account/Property/postProperty";
import {
  editProperty,
  updatePropertyStatus,
} from "../controllers/Account/Property/editProperty";
import { deleteProperty } from "../controllers/Account/Property/deleteProperty";
import {
  fetchSingleProperty,
  fetchAllProperties,
} from "../controllers/Account/Property/fetchProperty";
import { fetchUserInspections, getInspectionStats, getOneUserInspection } from "../controllers/Account/fetchInpections";
import { respondToInspectionRequest } from "../controllers/Account/inspectionRespond";
import {
  cancelFieldAgentRequest,
  getFieldAgentRepresentationTerms,
  listAvailableFieldAgents,
  listFieldAgentRepresentationRequests,
  requestFieldAgentForInspection,
  respondToFieldAgentRepresentationRequest,
} from "../controllers/Account/fieldAgentRepresentation";
import {
  getLicensedAgentRepresentationTerms,
  getMyPropertyScoutStatus,
  listAvailableLicensedAgents,
  listLicensedAgentRepresentationRequests,
  requestLicensedAgentForInspection,
  respondLicensedAgentRepresentation,
} from "../controllers/Account/licensedAgentRepresentation";
 
import {
  getAllNotifications,
  getNotificationById,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteAllNotifications,
  deleteNotificationById,
  bulkDeleteNotifications,
  markNotificationAsUnRead,
} from "../controllers/Account/notifications";
import {
  upsertAccountDeviceToken,
  removeAccountDeviceToken,
} from "../controllers/Account/deviceToken";
import {
  cancelAccountDeletion,
  changeEmail,
  changePassword,
  deleteAccountImmediately,
  getDashboardData,
  getProfile,
  requestAccountDeletion,
  updateNotificationSettings,
  updateProfile,
  updateProfilePicture,
} from "../controllers/Account/profileSettings";
import { updateAccountBrm } from "../controllers/Account/assignBrm";
import { assignBrmSchema } from "../validators/brm.validator";
import {
  getLawyerMe,
  updateLawyerProfile,
  submitLawyerKyc,
  setupLawyerBank,
  listLawyerVerificationJobs,
  getLawyerVerificationJob,
  respondLawyerVerificationJob,
  submitLawyerVerificationReport,
} from "../controllers/Account/Lawyer/lawyerAccount";
import {
  getSurveyorMe,
  updateSurveyorProfile,
  submitSurveyorKyc,
  setupSurveyorBank,
  listSurveyorJobs,
  getSurveyorJob,
  respondSurveyorJob,
  submitSurveyorJobReport,
} from "../controllers/Account/Surveyor/surveyorAccount";
import {
  getLawyerPublicPage,
  putLawyerPublicPage,
  checkLawyerPublicPageSlug,
  getSurveyorPublicPage,
  putSurveyorPublicPage,
  checkSurveyorPublicPageSlug,
} from "../controllers/Account/professionalPublicPage";
import {
  getMyCustomDomain,
  upsertMyCustomDomainRequest,
  payCustomDomainPackage,
  renewCustomDomain,
  submitIncludedCustomDomainRequest,
} from "../controllers/Account/customDomainAccount";
import { accountAuth } from "../middlewares/accountAuth";
import { getMatchedPreferencesForOwner, getOneMatchedPreferenceForOwner } from "../controllers/Account/Preference/fetchPreferences";
import { fetchDealsitePreferences, fetchDealsitePreferenceById } from "../controllers/Account/Preference/fetchDealsitePreferences";
import { completePublisherKYC } from "../controllers/Account/publisherKyc";
import {
  applyMyProfessionalUpgrade,
  getMyProfessionalUpgrade,
} from "../controllers/Account/professionalUpgrade";
import { getValuerMe, submitValuerKyc } from "../controllers/Account/Valuer/valuerAccount";
import { applyProfessionalUpgradeSchema } from "../validators/professionalUpgrade.validator";
import { completeOnboardingAgent } from "../controllers/Account/Agent/onBoarding";
import { broadcastToMySubscribers } from "../controllers/Account/Agent/agentSubscribers";
import { completeInspection, fetchAssignedInspections, fetchRecentAssignedInspections, getAssignedInspectionStats, getOneAssignedInspection, sendInspectionParticipantDetails, startInspection, submitInspectionReport } from "../controllers/Account/FieldAgent/getAllAssignedInspections";
import { fetchUserTransactions, getUserTransactionDetails } from "../controllers/Account/transactions";
import {
  listMyTransactionRegistrations,
  getMyTransactionCertificate,
} from "../controllers/Account/myTransactionRegistrations";
import { cancelSubscriptionSnapshot, createSubscription, fetchUserSubscriptions, getAllActiveSubscriptionPlans, getUserSubscriptionDetails, toggleSubscriptionSnapshotAutoRenewal } from "../controllers/Account/Agent/subscriptions";
import { getAgentEligibility } from "../controllers/Account/Agent/agentEligibility";
import {
  getPublisherListingEligibility,
  getUnlimitedListingPlanOffer,
} from "../controllers/Account/Publisher/publisherListingEligibility";
import { getDeveloperPlanEntitlementController } from "../controllers/Account/Developer/developerEntitlement";
import { validateJoi } from "../middlewares/validateJoi";
import { agentKycSchema } from "../validators/agentKYC.validator";
import {
  upsertDeviceTokenSchema,
  removeDeviceTokenSchema,
} from "../validators/buyerAuth.validator";
import { fetchReferralRecords, fetchReferralStats } from "../controllers/Account/referrals";
import { getDealSiteDetailsBySlug, getDealSiteDetailsByUser, getDealSiteLogsBySlug } from "../controllers/DealSite/verifyPublicAccessID";
import { bankList, checkSlugAvailability, createDealSite } from "../controllers/DealSite/setUp";
import { bulkUpdateDealSite, deleteDealSite, disableDealSite, enableDealSite, updateDealSite, getDealSiteContactMessages, deleteDealSiteContactMessage, getDealSiteEmailSubscribers, deleteDealSiteEmailSubscriber, exportDealSiteEmailSubscribers } from "../controllers/DealSite/otherActions";
import { fetchUserBookings, getBookingStats, getOneUserBooking, respondToBookingRequest } from "../controllers/Account/fetchBookings";
import { agentSubscriptionFeatureChecker } from "../middlewares/agentSubscriptionFeatureChecker";
import { fetchMyDealSitePreference } from "../controllers/DealSite/fetchDealSitePreferences";
import { fetchGeneralMarketplacePreferences } from "../controllers/Account/Preference/fetchGeneralMarketplacePreferences";
import { agentInitiatePreferenceMatch } from "../controllers/Account/Preference/agentInitiatePreferenceMatch";
import {
  getMarketplacePreferenceReview,
  upsertMarketplacePreferenceReview,
} from "../controllers/Account/Preference/preferenceReviewAccount";
import { createRequestToMarket, listRequestToMarket, respondToRequestToMarket, registerSaleForRequestToMarket } from "../controllers/requestToMarket/requestToMarketController";
import { suggestPropertyForm } from "../controllers/aiFormFill/aiFormFillController";
import {
  addInspectionRepresentative,
  deleteInspectionRepresentative,
  listInspectionRepresentatives,
  updateInspectionRepresentative,
} from "../controllers/Account/inspectionRepresentatives";
import {
  addPropertyInspectionRepresentative,
  deletePropertyInspectionRepresentative,
  listPropertyInspectionRepresentatives,
  updatePropertyInspectionRepresentative,
} from "../controllers/Account/propertyInspectionRepresentatives";
import {
  createSyndicationConnection,
  getSyndicationVerificationStatus,
  listApprovedSyndicationPlatforms,
  listMySyndicationConnections,
  toggleSyndicationConnection,
} from "../controllers/Account/syndicationConnections";

const AccountRouter = express.Router();

AccountRouter.use(accountAuth);
 
// PROFILE ROUTES
AccountRouter.get("/profile", getProfile);
AccountRouter.put("/brm", validateJoi(assignBrmSchema), updateAccountBrm);
AccountRouter.get("/dashboard", getDashboardData);
AccountRouter.patch("/updateAccount", updateProfile)
AccountRouter.patch("/updateProfilePicture", updateProfilePicture);
AccountRouter.delete("/requestAccountDeletion", requestAccountDeletion);
AccountRouter.post("/cancelAccountDeletion", cancelAccountDeletion);
AccountRouter.delete("/deleteAccountImmediately", deleteAccountImmediately);
AccountRouter.put("/changePassword", changePassword);
AccountRouter.put("/changeEmail", changeEmail);
AccountRouter.put("/notificationStatus", updateNotificationSettings);
AccountRouter.post(
  "/device-token",
  validateJoi(upsertDeviceTokenSchema),
  upsertAccountDeviceToken
);
AccountRouter.delete(
  "/device-token",
  validateJoi(removeDeviceTokenSchema),
  removeAccountDeviceToken
);

AccountRouter.put("/complete-onboarding", completeOnboardingAgent);

// AGENT UNIQUE ROUTES
AccountRouter.put("/submitKyc", validateJoi(agentKycSchema), completePublisherKYC);
AccountRouter.post(
  "/professional-upgrade",
  validateJoi(applyProfessionalUpgradeSchema),
  applyMyProfessionalUpgrade
);
AccountRouter.get("/professional-upgrade", getMyProfessionalUpgrade);
AccountRouter.get("/agent/eligibility", getAgentEligibility);
AccountRouter.get("/publisher/listing-eligibility", getPublisherListingEligibility);
AccountRouter.get("/publisher/unlimited-listing-plan", getUnlimitedListingPlanOffer);
AccountRouter.get("/developer/plan-entitlement", getDeveloperPlanEntitlementController);

// Agent broadcast to DealSite email subscribers (guests subscribe with email on DealSite)
AccountRouter.post("/agent/broadcast", broadcastToMySubscribers);

// PROPERTY ROUTES
AccountRouter.post("/properties/create", postProperty);

// Property page → requires "POST_PROPERTY"
// AccountRouter.post(
//   "/properties/create",
//   agentSubscriptionFeatureChecker({
//     requireActiveSubscription: true,
//     requiredFeatureKey: "LISTINGS",
//     allowedUserTypes: ["Agent", "Landowners"]
//   }),
//   postProperty
// );

// Preference page → requires "POST_PREFERENCE_PROPERTY"
// AccountRouter.post(
//   "/preferences/:preferenceId/properties",
//   agentSubscriptionFeatureChecker({
//     requireActiveSubscription: true,
//     requiredFeatureKey: "AGENT_MARKETPLACE",
//     allowedUserTypes: ["Agent"]
//   }),
//   postProperty
// );

// PROPERTY ROUTES
AccountRouter.post("/preferences/:preferenceId/properties", postProperty);

AccountRouter.patch("/properties/:propertyId/edit", editProperty);
AccountRouter.put("/properties/:propertyId/update", editProperty);
AccountRouter.patch("/properties/:propertyId/update", editProperty);
AccountRouter.patch("/properties/:propertyId/updateStatus", updatePropertyStatus);
AccountRouter.get("/properties/:propertyId/getOne", fetchSingleProperty);
AccountRouter.delete("/properties/:propertyId/delete", deleteProperty);
AccountRouter.get("/properties/fetchAll", fetchAllProperties);

// Per-property inspection representatives (approved User-owned listings; Landlords & Developers)
AccountRouter.get("/properties/:propertyId/inspection-representatives", listPropertyInspectionRepresentatives);
AccountRouter.post("/properties/:propertyId/inspection-representatives", addPropertyInspectionRepresentative);
AccountRouter.patch(
  "/properties/:propertyId/inspection-representatives/:representativeId",
  updatePropertyInspectionRepresentative,
);
AccountRouter.delete(
  "/properties/:propertyId/inspection-representatives/:representativeId",
  deletePropertyInspectionRepresentative,
);
  
// Inspection notification representatives (Landlords & Developers only)
AccountRouter.get("/inspection-representatives", listInspectionRepresentatives);
AccountRouter.post("/inspection-representatives", addInspectionRepresentative);
AccountRouter.patch("/inspection-representatives/:representativeId", updateInspectionRepresentative);
AccountRouter.delete("/inspection-representatives/:representativeId", deleteInspectionRepresentative);

// INSPECTIONS ROUTES
AccountRouter.get("/my-inspections/fetchAll", fetchUserInspections);
AccountRouter.get("/my-inspections/stats", getInspectionStats);
AccountRouter.post("/my-inspections/:inspectionId/respond", respondToInspectionRequest);
AccountRouter.get("/my-inspections/:inspectionId", getOneUserInspection);
AccountRouter.post(
  "/my-inspections/:inspectionId/request-field-agent",
  requestFieldAgentForInspection,
);
AccountRouter.delete(
  "/my-inspections/:inspectionId/field-agent-request",
  cancelFieldAgentRequest,
);

// Field Agent representation (legacy — prefer licensed-agents routes below)
AccountRouter.get("/field-agents/representation-terms", getFieldAgentRepresentationTerms);
AccountRouter.get("/field-agents/available", listAvailableFieldAgents);
AccountRouter.get(
  "/inspectionsFieldAgent/representation-requests",
  listFieldAgentRepresentationRequests,
);
AccountRouter.post(
  "/inspectionsFieldAgent/:inspectionId/representation/respond",
  respondToFieldAgentRepresentationRequest,
);

// Property Scout → licensed Agent representation (replaces Field Agent request UX)
AccountRouter.get("/property-scout/status", getMyPropertyScoutStatus);
AccountRouter.get(
  "/licensed-agents/representation-terms",
  getLicensedAgentRepresentationTerms,
);
AccountRouter.get("/licensed-agents/available", listAvailableLicensedAgents);
AccountRouter.get(
  "/licensed-agents/representation-requests",
  listLicensedAgentRepresentationRequests,
);
AccountRouter.post(
  "/my-inspections/:inspectionId/request-licensed-agent",
  requestLicensedAgentForInspection,
);
AccountRouter.post(
  "/licensed-agents/:inspectionId/representation/respond",
  respondLicensedAgentRepresentation,
);

// BOOKING REQUEST ROUTES
AccountRouter.get("/my-bookings/fetchAll", fetchUserBookings);
AccountRouter.get("/my-bookings/stats", getBookingStats);
AccountRouter.get("/my-bookings/:bookingId", getOneUserBooking);
AccountRouter.post("/my-bookings/:bookingId/respondToRequest", respondToBookingRequest);

// SUBSCRIPTION ROUTES
AccountRouter.post("/subscriptions/makeSub", createSubscription);
AccountRouter.get("/subscriptions/fetchAll", fetchUserSubscriptions);
AccountRouter.get("/subscriptions/fetchAllPlans", getAllActiveSubscriptionPlans);
AccountRouter.get("/subscriptions/:subscriptionId", getUserSubscriptionDetails);
AccountRouter.post("/subscriptions/:subscriptionId/cancel", cancelSubscriptionSnapshot);
AccountRouter.post("/subscriptions/:subscriptionId/cancelAutoRenewal", toggleSubscriptionSnapshotAutoRenewal);

// TRANSACTIONS ROUTES
AccountRouter.get("/transactions/fetchAll", fetchUserTransactions);
AccountRouter.get("/transactions/:transactionId", getUserTransactionDetails);
AccountRouter.get("/my-transaction-registrations", listMyTransactionRegistrations);
AccountRouter.get("/my-transaction-registrations/:reference", getMyTransactionCertificate);

// AI-assisted form fill (property) – Agent, Landlord, Developer
AccountRouter.post("/ai/suggest-property", suggestPropertyForm);

// REQUEST TO MARKET (LASRERA Market Place – Agent requests, Publisher accepts/rejects)
AccountRouter.post("/request-to-market", createRequestToMarket);
AccountRouter.get("/request-to-market", listRequestToMarket);
AccountRouter.post("/request-to-market/:requestId/respond", respondToRequestToMarket);
AccountRouter.post("/request-to-market/:requestId/register-sale", registerSaleForRequestToMarket);

// REFERRAL ROUTES
AccountRouter.get("/referrals/stats", fetchReferralStats);
AccountRouter.get("/referrals/records", fetchReferralRecords);

// DEAL SITE ROUTES
AccountRouter.post("/dealSite/setUp", createDealSite);
AccountRouter.post("/dealSite/slugAvailability", checkSlugAvailability);
AccountRouter.get("/dealSite/bankList", bankList);
AccountRouter.get("/dealSite/details", getDealSiteDetailsByUser);


// DEAL SITE CONTACT MESSAGES ROUTES
AccountRouter.get("/dealSite/contact-messages", getDealSiteContactMessages);
AccountRouter.delete("/dealSite/contact-messages/:messageId", deleteDealSiteContactMessage);

// DEAL SITE EMAIL SUBSCRIBERS ROUTES
AccountRouter.get("/dealSite/email-subscribers", getDealSiteEmailSubscribers);
AccountRouter.delete("/dealSite/email-subscribers/:subscriberId", deleteDealSiteEmailSubscriber);
AccountRouter.get("/dealSite/email-subscribers/export/csv", exportDealSiteEmailSubscribers);

// Bulk update endpoint (for updating multiple sections at once from frontend forms)
AccountRouter.post("/dealSite/update", bulkUpdateDealSite);

AccountRouter.get("/dealSite/get-preferences", fetchMyDealSitePreference);
AccountRouter.get("/dealSite/:publicSlug", getDealSiteDetailsBySlug);
AccountRouter.get("/dealSite/:publicSlug/logs", getDealSiteLogsBySlug);


// Single section update endpoint (for updating one section at a time)
AccountRouter.put("/dealSite/:publicSlug/:sectionName/update", updateDealSite);
AccountRouter.put("/dealSite/:publicSlug/pause", disableDealSite);
AccountRouter.put("/dealSite/:publicSlug/resume", enableDealSite);
AccountRouter.delete("/dealSite/:publicSlug/delete", deleteDealSite);


// FIELD AGENT INSPECTIONS ROUTES
AccountRouter.get("/inspectionsFieldAgent/fetchAll", fetchAssignedInspections);
AccountRouter.get("/inspectionsFieldAgent/fetchRecent", fetchRecentAssignedInspections);
AccountRouter.get("/inspectionsFieldAgent/stats", getAssignedInspectionStats);
AccountRouter.get("/inspectionsFieldAgent/:inspectionId", getOneAssignedInspection);
AccountRouter.post("/inspectionsFieldAgent/:inspectionId/sendDetails", sendInspectionParticipantDetails);
AccountRouter.post("/inspectionsFieldAgent/:inspectionId/submitReport", submitInspectionReport);
AccountRouter.post("/inspectionsFieldAgent/:inspectionId/startInspection", startInspection);
AccountRouter.post("/inspectionsFieldAgent/:inspectionId/stopInspection", completeInspection);

// MARKETPLACE — general (main-site) preferences for agent dashboard (review-only)
AccountRouter.get("/marketplace/general-preferences", fetchGeneralMarketplacePreferences);
AccountRouter.get(
  "/marketplace/preferences/:preferenceId/review",
  getMarketplacePreferenceReview
);
AccountRouter.put(
  "/marketplace/preferences/:preferenceId/review",
  upsertMarketplacePreferenceReview
);
AccountRouter.post("/marketplace/preferences/:preferenceId/match", agentInitiatePreferenceMatch);

// SYNDICATION (USER)
AccountRouter.get("/syndication/platforms", listApprovedSyndicationPlatforms);
AccountRouter.get("/syndication/connections/verification/:correlationId", getSyndicationVerificationStatus);
AccountRouter.post("/syndication/connections", createSyndicationConnection);
AccountRouter.patch("/syndication/connections/:id/toggle", toggleSyndicationConnection);
AccountRouter.get("/syndication/connections", listMySyndicationConnections);

// PREFERENCES ROUTES
AccountRouter.get("/my-preferences/fetchAll", getMatchedPreferencesForOwner);
AccountRouter.get("/my-preferences/:matchId", getOneMatchedPreferenceForOwner);
AccountRouter.get("/dealsite-preferences/fetchAll", fetchDealsitePreferences);
AccountRouter.get("/dealsite-preferences/:preferenceId", fetchDealsitePreferenceById);

// NOTIFICATIONS ROUTES
AccountRouter.get("/notifications", getAllNotifications);
AccountRouter.get("/notifications/:notificationId", getNotificationById);
AccountRouter.put("/notifications/:notificationId/markRead", markNotificationAsRead);
AccountRouter.put("/notifications/:notificationId/markUnRead", markNotificationAsUnRead);
AccountRouter.put("/notifications/markAllRead", markAllNotificationsAsRead);
AccountRouter.delete("/notifications/:notificationId/delete", deleteNotificationById);
AccountRouter.delete("/notifications/deleteAll", deleteAllNotifications);
AccountRouter.delete("/notifications/bulkDelete", bulkDeleteNotifications);

// LAWYER
AccountRouter.get("/lawyer/me", getLawyerMe);
AccountRouter.put("/lawyer/profile", updateLawyerProfile);
AccountRouter.put("/lawyer/kyc", submitLawyerKyc);
AccountRouter.post("/lawyer/bank", setupLawyerBank);
AccountRouter.get("/lawyer/verification-jobs", listLawyerVerificationJobs);
AccountRouter.get("/lawyer/verification-jobs/:id", getLawyerVerificationJob);
AccountRouter.post(
  "/lawyer/verification-jobs/:id/respond",
  respondLawyerVerificationJob
);
AccountRouter.post(
  "/lawyer/verification-jobs/:id/report",
  submitLawyerVerificationReport
);
AccountRouter.get("/lawyer/public-page", getLawyerPublicPage);
AccountRouter.put("/lawyer/public-page", putLawyerPublicPage);
AccountRouter.post("/lawyer/public-page/slug-availability", checkLawyerPublicPageSlug);

// SURVEYOR
AccountRouter.get("/surveyor/me", getSurveyorMe);
AccountRouter.put("/surveyor/profile", updateSurveyorProfile);
AccountRouter.put("/surveyor/kyc", submitSurveyorKyc);
AccountRouter.post("/surveyor/bank", setupSurveyorBank);
AccountRouter.get("/surveyor/jobs", listSurveyorJobs);
AccountRouter.get("/surveyor/jobs/:id", getSurveyorJob);
AccountRouter.post("/surveyor/jobs/:id/respond", respondSurveyorJob);
AccountRouter.post("/surveyor/jobs/:id/report", submitSurveyorJobReport);
AccountRouter.get("/surveyor/public-page", getSurveyorPublicPage);
AccountRouter.put("/surveyor/public-page", putSurveyorPublicPage);
AccountRouter.post(
  "/surveyor/public-page/slug-availability",
  checkSurveyorPublicPageSlug
);

// Custom domain package (DealSite or ProfessionalSite)
AccountRouter.get("/custom-domain", getMyCustomDomain);
AccountRouter.post("/custom-domain", upsertMyCustomDomainRequest);
AccountRouter.post(
  "/custom-domain/submit-included",
  submitIncludedCustomDomainRequest
);
AccountRouter.post("/custom-domain/pay", payCustomDomainPackage);
AccountRouter.post("/custom-domain/renew", renewCustomDomain);

AccountRouter.get("/valuer/me", getValuerMe);
AccountRouter.put("/valuer/kyc", submitValuerKyc);

export default AccountRouter;
