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
import { fetchUserInspections, getOneUserInspection } from "../controllers/Account/fetchInpections";

import {
  getAllNotifications,
  getNotificationById,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteAllNotifications,
  deleteNotificationById,
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
AccountRouter.post("/property/create", postProperty);
AccountRouter.patch("/property/:propertyId/edit", editProperty);
AccountRouter.patch("/property/:propertyId/updateStatus", updatePropertyStatus);
AccountRouter.get("/property/:propertyId/getOne", fetchSingleProperty);
AccountRouter.delete("/property/:propertyId/delete", deleteProperty);
AccountRouter.get("/property/fetchAll", fetchAllProperties);

// INSPECTIONS ROUTES
AccountRouter.get("/my-inspections/fetchAll", fetchUserInspections);
AccountRouter.get("/my-inspections/:inspectionId", getOneUserInspection);

// PREFERENCES ROUTES
AccountRouter.get("/my-preferences/fetchAll", getMatchedPreferencesForOwner);
AccountRouter.get("/my-preferences/:matchId", getOneMatchedPreferenceForOwner);

// NOTIFICATIONS ROUTES
AccountRouter.get("/notifications", getAllNotifications);
AccountRouter.get("/notifications/:notificationId", getNotificationById);
AccountRouter.patch(
  "/notifications/:notificationId/markRead",
  markNotificationAsRead,
);
AccountRouter.patch("/notifications/markAllRead", markAllNotificationsAsRead);
AccountRouter.delete(
  "/notifications/:notificationId/delete",
  deleteNotificationById,
);
AccountRouter.delete("/notifications/deleteAll", deleteAllNotifications);

export default AccountRouter;
