import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { DB } from "..";
import { generateToken, RouteError } from "../../common/classes";
import HttpStatusCodes from "../../common/HttpStatusCodes";

const buyerPublic = (buyer: any) => ({
  id: buyer._id,
  fullName: buyer.fullName,
  email: buyer.email,
  phoneNumber: buyer.phoneNumber,
  enableNotifications: buyer.enableNotifications !== false,
});

export const registerBuyer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { fullName, phoneNumber, email, password } = req.body;
    const normalizedEmail = String(email || "").toLowerCase().trim();

    const existing = await DB.Models.Buyer.findOne({ email: normalizedEmail });
    if (existing) {
      throw new RouteError(
        HttpStatusCodes.CONFLICT,
        "Email already registered. Please log in or reset your password."
      );
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);

    const buyer = await DB.Models.Buyer.create({
      fullName: String(fullName).trim(),
      phoneNumber: String(phoneNumber).trim(),
      email: normalizedEmail,
      password: hashedPassword,
      enableNotifications: true,
      devices: [],
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
