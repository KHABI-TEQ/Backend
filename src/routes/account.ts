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
import { accountAuth } from "../middlewares/accountAuth";
import { getMatchedPreferencesForOwner, getOneMatchedPreferenceForOwner } from "../controllers/Account/Preference/fetchPreferences";
import { completeAgentKYC, completeOnboardingAgent } from "../controllers/Account/Agent/onBoarding";
import { completeInspection, fetchAssignedInspections, fetchRecentAssignedInspections, getAssignedInspectionStats, getOneAssignedInspection, sendInspectionParticipantDetails, startInspection, submitInspectionReport } from "../controllers/Account/FieldAgent/getAllAssignedInspections";
import { fetchUserTransactions, getUserTransactionDetails } from "../controllers/Account/transactions";
import { cancelSubscriptionSnapshot, createSubscription, fetchUserSubscriptions, getAllActiveSubscriptionPlans, getUserSubscriptionDetails, toggleSubscriptionSnapshotAutoRenewal } from "../controllers/Account/Agent/subscriptions";
import { validateJoi } from "../middlewares/validateJoi";
import { agentKycSchema } from "../validators/agentKYC.validator";
import { fetchReferralRecords, fetchReferralStats } from "../controllers/Account/referrals";
import { getDealSiteDetailsBySlug, getDealSiteDetailsByUser, getDealSiteLogsBySlug } from "../controllers/DealSite/verifyPublicAccessID";
import { bankList, checkSlugAvailability, createDealSite } from "../controllers/DealSite/setUp";
import { deleteDealSite, disableDealSite, enableDealSite, updateDealSite } from "../controllers/DealSite/otherActions";
import { fetchUserBookings, getBookingStats, getOneUserBooking, respondToBookingRequest } from "../controllers/Account/fetchBookings";
import { agentSubscriptionFeatureChecker } from "../middlewares/agentSubscriptionFeatureChecker";
import { fetchMyDealSitePreference } from "../controllers/DealSite/fetchDealSitePreferences";

const AccountRouter = express.Router();

AccountRouter.use(accountAuth);
 
// PROFILE ROUTES
AccountRouter.get("/profile", getProfile);
AccountRouter.get("/dashboard", getDashboardData);
AccountRouter.patch("/updateAccount", updateProfile)
AccountRouter.patch("/updateProfilePicture", updateProfilePicture);
AccountRouter.delete("/requestAccountDeletion", requestAccountDeletion);
AccountRouter.post("/cancelAccountDeletion", cancelAccountDeletion);
AccountRouter.delete("/deleteAccountImmediately", deleteAccountImmediately);
AccountRouter.put("/changePassword", changePassword);
AccountRouter.put("/changeEmail", changeEmail);
AccountRouter.put("/notificationStatus", updateNotificationSettings);

AccountRouter.put("/complete-onboarding", completeOnboardingAgent);

// AGENT UNIQUE ROUTES
AccountRouter.put("/submitKyc", validateJoi(agentKycSchema), completeAgentKYC);

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
AccountRouter.patch("/properties/:propertyId/updateStatus", updatePropertyStatus);
AccountRouter.get("/properties/:propertyId/getOne", fetchSingleProperty);
AccountRouter.delete("/properties/:propertyId/delete", deleteProperty);
AccountRouter.get("/properties/fetchAll", fetchAllProperties);
  
// INSPECTIONS ROUTES
AccountRouter.get("/my-inspections/fetchAll", fetchUserInspections);
AccountRouter.get("/my-inspections/stats", getInspectionStats);
AccountRouter.get("/my-inspections/:inspectionId", getOneUserInspection);
  
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

// REFERRAL ROUTES
AccountRouter.get("/referrals/stats", fetchReferralStats);
AccountRouter.get("/referrals/records", fetchReferralRecords);

// DEAL SITE ROUTES
AccountRouter.post("/dealSite/setUp", createDealSite);
AccountRouter.post("/dealSite/slugAvailability", checkSlugAvailability);
AccountRouter.get("/dealSite/bankList", bankList);
AccountRouter.get("/dealSite/details", getDealSiteDetailsByUser);
AccountRouter.get("/dealSite/get-preferences", fetchMyDealSitePreference);
AccountRouter.get("/dealSite/:publicSlug", getDealSiteDetailsBySlug);
AccountRouter.get("/dealSite/:publicSlug/logs", getDealSiteLogsBySlug);
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

// PREFERENCES ROUTES
AccountRouter.get("/my-preferences/fetchAll", getMatchedPreferencesForOwner);
AccountRouter.get("/my-preferences/:matchId", getOneMatchedPreferenceForOwner);

// NOTIFICATIONS ROUTES
AccountRouter.get("/notifications", getAllNotifications);
AccountRouter.get("/notifications/:notificationId", getNotificationById);
AccountRouter.put("/notifications/:notificationId/markRead", markNotificationAsRead);
AccountRouter.put("/notifications/:notificationId/markUnRead", markNotificationAsUnRead);
AccountRouter.put("/notifications/markAllRead", markAllNotificationsAsRead);
AccountRouter.delete("/notifications/:notificationId/delete", deleteNotificationById);
AccountRouter.delete("/notifications/deleteAll", deleteAllNotifications);
AccountRouter.delete("/notifications/bulkDelete", bulkDeleteNotifications);

export default AccountRouter;
