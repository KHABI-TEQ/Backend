import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { DB } from "..";
import { RouteError } from "../../common/classes";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { verifyEmailTemplate, generalTemplate } from "../../common/email.template";
import sendEmail from "../../common/send.email";
import { generateUniqueAccountId, generateUniqueReferralCode } from "../../utils/generateUniqueAccountId";
import { referralService } from "../../services/referral.service";
import { Types } from "mongoose";
import { SystemSettingService } from "../../services/systemSetting.service";

/**
 * Traditional Registration
 */
export const registerUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      userType,
      phoneNumber,
      address,
      referralCode,
    } = req.body;

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await DB.Models.User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Account already exists with this email.",
      );
    }

    let referrerUser = null;

    if (referralCode) {
      referrerUser = await DB.Models.User.findOne({
        referralCode: referralCode,
        accountStatus: "active",
        isAccountVerified: true,
        isDeleted: false,
      });

      if (!referrerUser) {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          "Invalid or inactive referral code.",
        );
      }
    } 

    const hashedPassword = await bcrypt.hash(password, 10);
    const accountId = await generateUniqueAccountId();
    const generateReferralCode = await generateUniqueReferralCode();

    const newUser = await DB.Models.User.create({
      firstName,
      lastName,
      email: normalizedEmail,
      password: hashedPassword,
      userType,
      phoneNumber,
      address,
      accountId,
      referralCode: generateReferralCode,
      referredBy: referralCode,
      isAccountInRecovery: false,
      profile_picture: "",
      isInActive: false,
      isDeleted: false,
      accountStatus: "inactive",
      isFlagged: false,
      isAccountVerified: false,
      accountApproved: false,
    });

    if (userType === "Agent") {
      await DB.Models.Agent.create({
        userId: newUser._id,
        accountStatus: "inactive",
      });
    }

    const referralStatusSettings = await SystemSettingService.getSetting("referral_enabled");
    if (referralStatusSettings?.value) {
      const referralRegisteredPoints = await SystemSettingService.getSetting("referral_register_price");
      // ✅ Log the referral if valid
      if (referrerUser && newUser) {
        await referralService.createReferralLog({
          referrerId: new Types.ObjectId(referrerUser._id as Types.ObjectId),
          referredUserId: new Types.ObjectId(newUser._id as Types.ObjectId),
          rewardType: "registration_bonus",
          triggerAction: "user_signup",
          note: "Referral at account registration",
          rewardStatus: "pending",
          rewardAmount: referralRegisteredPoints?.value || 0
        });
      } 
    }

    // Generate and send email verification link
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours

    await DB.Models.VerificationToken.create({
      userId: newUser._id,
      token,
      expiresAt,
    });

    const verificationLink = `${process.env.CLIENT_LINK}/auth/verify-account?token=${token}`;
    const mailBody = verifyEmailTemplate(newUser.firstName, verificationLink);
    const html = generalTemplate(mailBody);

    await sendEmail({
      to: newUser.email,
      subject: "Verify Your Email Address",
      text: "Verify Your Email Address",
      html,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Account created successfully. Please verify your email.",
    });
  } catch (err: any) {
    console.error("Registration Error:", err.message);
    next(err);
  }
};
