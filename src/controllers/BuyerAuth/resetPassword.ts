import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";

/**
 * @swagger
 * /buyer-auth/reset-password:
 *   post:
 *     tags:
 *       - Buyer Auth
 *     summary: Reset buyer password
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               code:
 *                 type: string
 *                 description: Password reset code
 *               newPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Bad request
 *       404:
 *         description: Invalid code or user not found
 */
export const resetBuyerPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, token, newPassword } = req.body;
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

    if (!resetToken || resetToken.expiresAt < new Date()) {
      throw new RouteError(
        HttpStatusCodes.UNAUTHORIZED,
        "Invalid or expired token."
      );
    }

    buyer.password = await bcrypt.hash(String(newPassword), 10);
    await buyer.save();

    await DB.Models.PasswordResetToken.deleteMany({
      userId: buyer._id,
      userModel: "Buyer",
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Password reset successful. You can now log in.",
    });
  } catch (err) {
    next(err);
  }
};
