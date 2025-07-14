import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { DB } from '..';
import { RouteError } from "../../common/classes";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { verifyEmailTemplate } from "../../common/email.template";
import { generalTemplate } from "../../common/email.template";
import sendEmail from "../../common/send.email";
import { generateUniqueAccountId } from "../../utils/generateUniqueAccountId";

/**
 * Traditional Registration
 * @param req 
 * @param res 
 * @param next 
 * @returns 
 */
export const registerUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, email, password, userType, phoneNumber, address } = req.body;

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await DB.Models.User.findOne({ email: normalizedEmail });

    if (existingUser) throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Account already exists with this email.");

    const hashedPassword = await bcrypt.hash(password, 10);

    const accountId = await generateUniqueAccountId();

    const newUser = await DB.Models.User.create({
      firstName,
      lastName,
      email: normalizedEmail,
      password: hashedPassword,
      userType,
      phoneNumber,
      address,
      accountId,
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
      await DB.Models.Agent.create({ userId: newUser._id, accountStatus: "active" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

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
