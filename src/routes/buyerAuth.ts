import express from "express";
import { validateJoi } from "../middlewares/validateJoi";
import buyerAuth from "../middlewares/buyerAuth";
import {
  registerBuyerSchema,
  loginBuyerSchema,
  buyerEmailSchema,
  verifyBuyerResetCodeSchema,
  resetBuyerPasswordSchema,
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
  upsertBuyerDeviceToken,
  removeBuyerDeviceToken,
} from "../controllers/BuyerAuth/deviceToken";
import {
  getBuyerProfile,
  updateBuyerProfile,
} from "../controllers/BuyerAuth/profile";

const BuyerAuthRouter = express.Router();

BuyerAuthRouter.post(
  "/register",
  validateJoi(registerBuyerSchema),
  registerBuyer
);

BuyerAuthRouter.post("/login", validateJoi(loginBuyerSchema), loginBuyer);

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
