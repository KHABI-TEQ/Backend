import { Request, Response, NextFunction } from "express";
import { DB } from "..";
import { generateToken, RouteError } from "../../common/classes";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import sendEmail from "../../common/send.email";
import {
  generalTemplate,
  BuyerLoginOtpTemplate,
} from "../../common/email.template";
import { buyerPublic } from "./profile";

const OTP_TTL_MS = 10 * 60 * 1000;
const GENERIC_OK =
  "If this email has activity with Khabi-Teq, a verification code was sent.";

function normalizeEmail(email: unknown) {
  return String(email || "")
    .toLowerCase()
    .trim();
}

async function issueOtp(email: string) {
  const buyer = await DB.Models.Buyer.findOne({ email });
  if (!buyer) {
    return { sent: false as const };
  }

  await DB.Models.BuyerEmailOtp.deleteMany({ email, purpose: "login" });

  const token = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await DB.Models.BuyerEmailOtp.create({
    email,
    token,
    expiresAt,
    purpose: "login",
  });

  const mailBody = BuyerLoginOtpTemplate(
    buyer.fullName || buyer.email,
    token
  );
  const html = generalTemplate(mailBody);

  await sendEmail({
    to: buyer.email,
    subject: "Your Khabi-Teq verification code",
    text: `Your Khabi-Teq verification code is ${token}. It expires in 10 minutes.`,
    html,
  });

  return { sent: true as const };
}

export const requestBuyerLoginOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Email is required.");
    }

    await issueOtp(email);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: GENERIC_OK,
    });
  } catch (err) {
    next(err);
  }
};

export const resendBuyerLoginOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Email is required.");
    }

    await issueOtp(email);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: GENERIC_OK,
    });
  } catch (err) {
    next(err);
  }
};

export const verifyBuyerLoginOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const email = normalizeEmail(req.body.email);
    const token = String(req.body.token || "").trim();

    if (!email || !token) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Email and verification code are required."
      );
    }

    const buyer = await DB.Models.Buyer.findOne({ email });
    if (!buyer) {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        "No activity found for this email. Submit a preference or inspection first, then try again."
      );
    }

    const otp = await DB.Models.BuyerEmailOtp.findOne({
      email,
      token,
      purpose: "login",
    });

    if (!otp) {
      throw new RouteError(
        HttpStatusCodes.UNAUTHORIZED,
        "Invalid verification code."
      );
    }

    if (otp.expiresAt < new Date()) {
      await otp.deleteOne();
      throw new RouteError(
        HttpStatusCodes.UNAUTHORIZED,
        "Verification code has expired. Request a new one."
      );
    }

    await DB.Models.BuyerEmailOtp.deleteMany({ email, purpose: "login" });

    const jwt = generateToken({
      id: buyer._id.toString(),
      email: buyer.email,
      userType: "Buyer",
      role: "buyer",
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Verified successfully.",
      data: {
        token: jwt,
        buyer: buyerPublic(buyer),
      },
    });
  } catch (err) {
    next(err);
  }
};
