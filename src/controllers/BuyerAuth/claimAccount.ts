import { Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { DB } from "..";
import { generateToken, RouteError } from "../../common/classes";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { AppRequest } from "../../types/express";
import { buyerPublic } from "./profile";

/**
 * @swagger
 * /buyer-auth/claim-account:
 *   post:
 *     tags:
 *       - Buyer Auth
 *     summary: Claim buyer account
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
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               code:
 *                 type: string
 *                 description: Account claim code
 *     responses:
 *       200:
 *         description: Account claimed successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Invalid code or user not found
 */
export const claimBuyerAccount = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { fullName, phoneNumber, email, password } = req.body;
    const normalizedEmail = String(email || "")
      .toLowerCase()
      .trim();

    const existing = await DB.Models.Buyer.findOne({ email: normalizedEmail });
    if (!existing) {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        "No account was found for this email. Please register instead."
      );
    }
    if (existing.password) {
      throw new RouteError(
        HttpStatusCodes.CONFLICT,
        "This account already exists. Please log in."
      );
    }

    existing.password = await bcrypt.hash(String(password), 10);
    if (fullName) existing.fullName = String(fullName).trim();
    if (phoneNumber) existing.phoneNumber = String(phoneNumber).trim();
    await existing.save();

    const token = generateToken({
      id: existing._id.toString(),
      email: existing.email,
      userType: "Buyer",
      role: "buyer",
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Account claimed. You can now insure searches and file claims.",
      data: {
        token,
        buyer: buyerPublic(existing),
      },
    });
  } catch (err) {
    next(err);
  }
};
