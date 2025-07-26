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
  changeEmail,
  changePassword,
  getDashboardData,
  getProfile,
  requestAccountDeletion,
  updateNotificationSettings,
  updateProfile,
} from "../controllers/Account/profileSettings";
import { accountAuth } from "../middlewares/accountAuth";
import { getMatchedPreferencesForOwner, getOneMatchedPreferenceForOwner } from "../controllers/Account/Preference/fetchPreferences";

const AccountRouter = express.Router();

AccountRouter.use(accountAuth);
 
// PROFILE ROUTES
AccountRouter.get("/profile", getProfile);
AccountRouter.get("/dashboard", getDashboardData);
AccountRouter.patch("/updateAccount", updateProfile);
AccountRouter.delete("/requestAccountDeletion", requestAccountDeletion);
AccountRouter.put("/changePassword", changePassword);
AccountRouter.put("/changeEmail", changeEmail);
AccountRouter.put("/notificationStatus", updateNotificationSettings);

// PROPERTY ROUTES
AccountRouter.post("/properties/create", postProperty);
AccountRouter.patch("/properties/:propertyId/edit", editProperty);
AccountRouter.patch("/properties/:propertyId/updateStatus", updatePropertyStatus);
AccountRouter.get("/properties/:propertyId/getOne", fetchSingleProperty);
AccountRouter.delete("/properties/:propertyId/delete", deleteProperty);
AccountRouter.get("/properties/fetchAll", fetchAllProperties);
 
// INSPECTIONS ROUTES
AccountRouter.get("/my-inspections/fetchAll", fetchUserInspections);
AccountRouter.get("/my-inspections/stats", getInspectionStats);
AccountRouter.get("/my-inspections/:inspectionId", getOneUserInspection);

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
