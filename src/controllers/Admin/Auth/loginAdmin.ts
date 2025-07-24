import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { generateToken, RouteError } from "../../../common/classes";

export const loginAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const admin = await DB.Models.Admin.findOne({ email: normalizedEmail });

    if (!admin) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Admin account not found.");
    }

    if (!admin.password) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "This admin was registered without a password."
      );
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Invalid password.");
    }

    if (!admin.isAccountVerified) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Admin account is not verified. Please contact the super admin."
      );
    }

    const token = generateToken({
      id: admin._id.toString(),
      email: admin.email,
      userType: "Admin",
      role: admin.role,
    });

    const adminResponse = {
      id: admin._id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      phoneNumber: admin.phoneNumber,
      fullName: admin.fullName,
      role: admin.role,
      address: admin.address,
      profile_picture: admin.profile_picture,
      isAccountVerified: admin.isAccountVerified,
      isAccountInRecovery: admin.isAccountInRecovery,
    };

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        admin: adminResponse,
      },
    });
  } catch (err) {
    console.error("Admin login error:", err.message);
    next(err);
  }
};
