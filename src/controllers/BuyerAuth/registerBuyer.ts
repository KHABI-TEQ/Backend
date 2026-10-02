import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { DB } from "..";
import { generateToken, RouteError } from "../../common/classes";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { buyerPublic } from "./profile";
import { resolveActiveBrmId } from "../Account/assignBrm";

/**
 * @swagger
 * /buyer-auth/register:
 *   post:
 *     tags:
 *       - Buyer Auth
 *     summary: Register buyer
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *               - phoneNumber
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       201:
 *         description: Buyer registered successfully
 *       400:
 *         description: Bad request
 *       409:
 *         description: Buyer already exists
 */
export const registerBuyer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { fullName, phoneNumber, email, password, brmId } = req.body;
    const normalizedEmail = String(email || "").toLowerCase().trim();

    const existing = await DB.Models.Buyer.findOne({ email: normalizedEmail });
    if (existing) {
      throw new RouteError(
        HttpStatusCodes.CONFLICT,
        existing.password
          ? "This account already exists. Please log in."
          : "A saved preference exists for this email. Create a password to claim it and continue."
      );
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);
    const resolvedBrmId = brmId ? await resolveActiveBrmId(brmId) : null;

    const buyer = await DB.Models.Buyer.create({
      fullName: String(fullName).trim(),
      phoneNumber: String(phoneNumber).trim(),
      email: normalizedEmail,
      password: hashedPassword,
      enableNotifications: true,
      devices: [],
      ...(resolvedBrmId ? { brmId: resolvedBrmId } : {}),
    });

    const token = generateToken({
      id: buyer._id.toString(),
      email: buyer.email,
      userType: "Buyer",
      role: "buyer",
    });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Buyer account created successfully.",
      data: {
        token,
        buyer: buyerPublic(buyer),
      },
    });
  } catch (err) {
    next(err);
  }
};
