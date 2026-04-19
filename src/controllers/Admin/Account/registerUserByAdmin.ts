import { Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { generateUniqueAccountId, generateUniqueReferralCode } from "../../../utils/generateUniqueAccountId";
import { generateRandomPassword } from "../../../utils/generatePassword";
import { notifyUserAdminProvisioned } from "../../../services/userProvisioningNotifications.service";

const ALLOWED_TYPES = ["Agent", "Developer", "Landowners"] as const;
type AllowedUserType = (typeof ALLOWED_TYPES)[number];

function isAllowedUserType(t: string): t is AllowedUserType {
  return (ALLOWED_TYPES as readonly string[]).includes(t);
}

/**
 * POST /admin/users/register
 * Creates Agent, Developer, or Landowner with a temporary password; user must change password after first login.
 */
export const registerUserByAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      address,
      userType,
      password: bodyPassword,
    } = req.body as {
      firstName?: string;
      lastName?: string;
      email?: string;
      phoneNumber?: string;
      address?: { street?: string; state?: string; localGovtArea?: string };
      userType?: string;
      password?: string;
    };

    if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !userType) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "firstName, lastName, email, and userType are required."
      );
    }

    if (!isAllowedUserType(userType)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        `userType must be one of: ${ALLOWED_TYPES.join(", ")}`
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const exists = await DB.Models.User.findOne({ email: normalizedEmail });
    if (exists) {
      throw new RouteError(
        HttpStatusCodes.CONFLICT,
        "An account already exists with this email."
      );
    }

    const plainPassword = bodyPassword?.trim() || generateRandomPassword(12);
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const accountId = await generateUniqueAccountId();
    const referralCode = await generateUniqueReferralCode();

    const newUser = await DB.Models.User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      userType,
      phoneNumber: phoneNumber?.trim(),
      address: address || undefined,
      accountId,
      referralCode,
      isAccountInRecovery: false,
      profile_picture: "",
      isInActive: false,
      isDeleted: false,
      isAccountVerified: true,
      accountApproved: true,
      accountStatus: "active",
      isFlagged: false,
      mustChangePassword: true,
    });

    if (userType === "Agent") {
      await DB.Models.Agent.create({
        userId: newUser._id,
        kycStatus: "none",
      });
    }

    try {
      await notifyUserAdminProvisioned({
        email: newUser.email,
        firstName: newUser.firstName,
        phoneNumber: newUser.phoneNumber,
        temporaryPassword: plainPassword,
        userType,
      });
    } catch (notifyErr) {
      console.warn("[registerUserByAdmin] notification failed:", notifyErr);
    }

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message:
        "User created. Credentials were sent by email (and WhatsApp when configured).",
      data: {
        id: newUser._id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        userType: newUser.userType,
        mustChangePassword: true,
      },
    });
  } catch (err) {
    next(err);
  }
};
