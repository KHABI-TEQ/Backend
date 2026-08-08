import { Request, Response, NextFunction } from "express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import sendEmail from "../../common/send.email";
import {
  generalTemplate,
  ForgotPasswordTokenTemplate,
} from "../../common/email.template";

export const resendBuyerPasswordResetCode = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email || "").toLowerCase().trim();

    const buyer = await DB.Models.Buyer.findOne({ email: normalizedEmail });
    if (!buyer || !buyer.password) {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        "No buyer account found with this email."
      );
    }

    await DB.Models.PasswordResetToken.deleteMany({
      userId: buyer._id,
      userModel: "Buyer",
    });

    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000);

    await DB.Models.PasswordResetToken.create({
      userId: buyer._id,
      userModel: "Buyer",
      token,
      expiresAt,
    });

    const mailBody = ForgotPasswordTokenTemplate(buyer.fullName || buyer.email, token);
    const html = generalTemplate(mailBody);

    await sendEmail({
      to: buyer.email,
      subject: "Your Password Reset Code",
      text: `Your password reset code is ${token}`,
      html,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Password reset code resent successfully.",
    });
  } catch (err) {
    next(err);
  }
};
