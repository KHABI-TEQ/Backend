import express from "express";
import { loginUser } from "../controllers/Auth/loginUser";
import { registerUser } from "../controllers/Auth/registerUser";
import { requestPasswordReset } from "../controllers/Auth/requestPasswordReset";
import { resetPassword } from "../controllers/Auth/resetPassword";
import { resendVerificationToken } from "../controllers/Auth/resendVerificationToken";
import { resendPasswordResetCode } from "../controllers/Auth/resendPasswordResetCode";
import { verifyAccount } from "../controllers/Auth/verifyAccount";
import { googleAuth, facebookAuth } from "../controllers/Auth/socialAuth";
import { verifyPasswordResetCode } from "../controllers/Auth/verifyPasswordResetCode";
import { oauthRegisterSchema, registerUserSchema } from "../validators/user.validator";
import { validateJoi } from "../middlewares/validateJoi";

const AuthRouter = express.Router();

// Login route for "AGENTS" and "LANDOWNERS"
AuthRouter.post("/login", loginUser);

// Registration route for "AGENTS" and "LANDOWNERS"
AuthRouter.post("/register", validateJoi(registerUserSchema), registerUser);

// Google auth (signin and signup) route for "AGENTS" and "LANDOWNERS"
AuthRouter.post("/googleAuth", validateJoi(oauthRegisterSchema), googleAuth);

// FaceBook auth (signin and signup) route for "AGENTS" and "LANDOWNERS"
AuthRouter.post("/facebookAuth", validateJoi(oauthRegisterSchema), facebookAuth);

// Reset Password Request route for "AGENTS" and "LANDOWNERS"
AuthRouter.post("/resetPasswordRequest", requestPasswordReset);

// Veryfy Reset Password Code route for "AGENTS" and "LANDOWNERS"
AuthRouter.post("/verifyPasswordResetCode", verifyPasswordResetCode);

// Reset Password route for "AGENTS" and "LANDOWNERS"
AuthRouter.post("/resetPassword", resetPassword);

// Resend Verification Token route for "AGENTS" and "LANDOWNERS"
AuthRouter.post("/resendVerificationToken", resendVerificationToken);

// Resend Reset Password Code route for "AGENTS" and "LANDOWNERS"
AuthRouter.post("/resendPasswordCode", resendPasswordResetCode);

// verify account route for "AGENTS" and "LANDOWNERS"
AuthRouter.get("/verifyAccount", verifyAccount);

export { AuthRouter };
