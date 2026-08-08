import { Request, Response, NextFunction } from "express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";

export const verifyBuyerPasswordResetCode = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, token } = req.body;
    const normalizedEmail = String(email || "").toLowerCase().trim();

    const buyer = await DB.Models.Buyer.findOne({ email: normalizedEmail });
    if (!buyer) {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        "No buyer account found with this email."
      );
    }

    const resetToken = await DB.Models.PasswordResetToken.findOne({
      userId: buyer._id,
      userModel: "Buyer",
      token: String(token).trim(),
    });

    if (!resetToken) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Invalid reset code.");
    }

    if (resetToken.expiresAt < new Date()) {
      throw new RouteError(
        HttpStatusCodes.UNAUTHORIZED,
        "Reset code has expired."
      );
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Reset code is valid.",
    });
  } catch (err) {
    next(err);
  }
};
