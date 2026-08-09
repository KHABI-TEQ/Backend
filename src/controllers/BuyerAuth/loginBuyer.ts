import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { DB } from "..";
import { generateToken, RouteError } from "../../common/classes";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { buyerPublic } from "./profile";

export const loginBuyer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || "").toLowerCase().trim();
    const passwordInput = String(password ?? "");

    if (!passwordInput) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Password is required.");
    }

    const buyer = await DB.Models.Buyer.findOne({ email: normalizedEmail });
    if (!buyer) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Account not found.");
    }

    if (!buyer.password) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "This email is not registered for mobile login. Please sign up."
      );
    }

    const isMatch = await bcrypt.compare(passwordInput, buyer.password);
    if (!isMatch) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Invalid password.");
    }

    const token = generateToken({
      id: buyer._id.toString(),
      email: buyer.email,
      userType: "Buyer",
      role: "buyer",
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Login successful.",
      data: {
        token,
        buyer: buyerPublic(buyer),
      },
    });
  } catch (err) {
    next(err);
  }
};
