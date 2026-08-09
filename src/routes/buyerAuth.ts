import express from "express";
import { validateJoi } from "../middlewares/validateJoi";
import buyerAuth from "../middlewares/buyerAuth";
import {
  registerBuyerSchema,
  loginBuyerSchema,
  buyerEmailSchema,
  verifyBuyerResetCodeSchema,
  resetBuyerPasswordSchema,
  verifyBuyerLoginOtpSchema,
  upsertDeviceTokenSchema,
  removeDeviceTokenSchema,
  updateBuyerProfileSchema,
} from "../validators/buyerAuth.validator";
import { registerBuyer } from "../controllers/BuyerAuth/registerBuyer";
import { loginBuyer } from "../controllers/BuyerAuth/loginBuyer";
import { requestBuyerPasswordReset } from "../controllers/BuyerAuth/requestPasswordReset";
import { verifyBuyerPasswordResetCode } from "../controllers/BuyerAuth/verifyPasswordResetCode";
import { resetBuyerPassword } from "../controllers/BuyerAuth/resetPassword";
import { resendBuyerPasswordResetCode } from "../controllers/BuyerAuth/resendPasswordResetCode";
import {
  requestBuyerLoginOtp,
  resendBuyerLoginOtp,
  verifyBuyerLoginOtp,
} from "../controllers/BuyerAuth/otpLogin";
import {
  upsertBuyerDeviceToken,
  removeBuyerDeviceToken,
} from "../controllers/BuyerAuth/deviceToken";
import {
  getBuyerProfile,
  updateBuyerProfile,
} from "../controllers/BuyerAuth/profile";
import {
  getMyPreferences,
  getMyInspections,
  getMyDocumentVerifications,
  getMyTransactionRegistrations,
  getMyActivitySummary,
} from "../controllers/BuyerAuth/meActivity";
import {
  listMyNotifications,
  getMyUnreadNotificationCount,
  markMyNotificationRead,
  markAllMyNotificationsRead,
} from "../controllers/BuyerAuth/notifications";

const BuyerAuthRouter = express.Router();

BuyerAuthRouter.post(
  "/register",
  validateJoi(registerBuyerSchema),
  registerBuyer
);

BuyerAuthRouter.post("/login", validateJoi(loginBuyerSchema), loginBuyer);

BuyerAuthRouter.post(
  "/otp/request",
  validateJoi(buyerEmailSchema),
  requestBuyerLoginOtp
);

BuyerAuthRouter.post(
  "/otp/resend",
  validateJoi(buyerEmailSchema),
  resendBuyerLoginOtp
);

BuyerAuthRouter.post(
  "/otp/verify",
  validateJoi(verifyBuyerLoginOtpSchema),
  verifyBuyerLoginOtp
);

BuyerAuthRouter.post(
  "/reset-password-request",
  validateJoi(buyerEmailSchema),
  requestBuyerPasswordReset
);

BuyerAuthRouter.post(
  "/verify-reset-code",
  validateJoi(verifyBuyerResetCodeSchema),
  verifyBuyerPasswordResetCode
);

BuyerAuthRouter.post(
  "/reset-password",
  validateJoi(resetBuyerPasswordSchema),
  resetBuyerPassword
);

BuyerAuthRouter.post(
  "/resend-reset-code",
  validateJoi(buyerEmailSchema),
  resendBuyerPasswordResetCode
);

BuyerAuthRouter.get("/me", buyerAuth, getBuyerProfile);

BuyerAuthRouter.get("/me/summary", buyerAuth, getMyActivitySummary);

BuyerAuthRouter.get("/me/preferences", buyerAuth, getMyPreferences);

BuyerAuthRouter.get("/me/inspections", buyerAuth, getMyInspections);

BuyerAuthRouter.get(
  "/me/document-verifications",
  buyerAuth,
  getMyDocumentVerifications
);

BuyerAuthRouter.get(
  "/me/transaction-registrations",
  buyerAuth,
  getMyTransactionRegistrations
);

BuyerAuthRouter.get("/me/notifications", buyerAuth, listMyNotifications);

BuyerAuthRouter.get(
  "/me/notifications/unread-count",
  buyerAuth,
  getMyUnreadNotificationCount
);

BuyerAuthRouter.put(
  "/me/notifications/mark-all-read",
  buyerAuth,
  markAllMyNotificationsRead
);

BuyerAuthRouter.put(
  "/me/notifications/:notificationId/read",
  buyerAuth,
  markMyNotificationRead
);

BuyerAuthRouter.put(
  "/profile",
  buyerAuth,
  validateJoi(updateBuyerProfileSchema),
  updateBuyerProfile
);

BuyerAuthRouter.post(
  "/device-token",
  buyerAuth,
  validateJoi(upsertDeviceTokenSchema),
  upsertBuyerDeviceToken
);

BuyerAuthRouter.delete(
  "/device-token",
  buyerAuth,
  validateJoi(removeDeviceTokenSchema),
  removeBuyerDeviceToken
);

export default BuyerAuthRouter;
