import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { DB } from "..";
import crypto from "crypto";
import { generateToken, RouteError } from "../../common/classes";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { verifyEmailTemplate } from "../../common/email.template";
import { generalTemplate } from "../../common/email.template";
import sendEmail from "../../common/send.email";

export const loginUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await DB.Models.User.findOne({ email: normalizedEmail });

    if (!user) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Account not found.");
    }

    if (!user.password) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "This email is registered via social login. Please use Google or Facebook to sign in."
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Invalid password.");
    }

    // Re-send verification email if not verified
    if (!user.isAccountVerified) {
      // Remove any existing tokens
      await DB.Models.VerificationToken.deleteMany({ userId: user._id });

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours
      await DB.Models.VerificationToken.create({
        userId: user._id,
        token,
        expiresAt,
      });

      const verificationLink = `${process.env.CLIENT_LINK}/auth/verify-account?token=${token}`;
      const emailBody = verifyEmailTemplate(user.firstName, verificationLink);
      const mail = generalTemplate(emailBody);

      await sendEmail({
        to: user.email,
        subject: "Verify Your Email Address",
        text: "Please verify your email to log in",
        html: mail,
      });

      throw new RouteError(HttpStatusCodes.FORBIDDEN, "Email not verified. A verification link has been sent.");
    }

    if (user.isInActive || user.isDeleted || user.accountStatus === "inactive" || user.accountStatus === "deleted") {
      throw new RouteError(HttpStatusCodes.FORBIDDEN, "Your account is inactive or has been deleted. Please contact support.");
    }

    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      userType: user.userType,
    });

    const userResponse = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      userType: user.userType,
      isAccountVerified: user.isAccountVerified,
      accountApproved: user.accountApproved,
      isAccountInRecovery: user.isAccountInRecovery,
      address: user.address,
      profile_picture: user.profile_picture,
      isInActive: user.isInActive,
      isDeleted: user.isDeleted,
      accountStatus: user.accountStatus,
      isFlagged: user.isFlagged,
      accountId: user.accountId,
    };

    if (user.userType === "Agent") {
      const agentData = await DB.Models.Agent.findOne({ userId: user._id });

      return res.status(HttpStatusCodes.OK).json({
        message: "Login successful",
        token,
        user: userResponse,
        agentData,
        isAccountApproved: user.accountApproved,
      });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Login successful",
      token,
      user: userResponse,
    });

  } catch (err: any) {
    console.error("Login error:", err.message);
    next(err);
  }
};
