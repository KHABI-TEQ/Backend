import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { DB } from "../controllers";
import { AppRequest } from "../types/express";
import HttpStatusCodes from "../common/HttpStatusCodes";

/**
 * Requires Authorization: Bearer <token> with role "buyer".
 * Loads Buyer onto req.buyer.
 */
const buyerAuth = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const rawAuthHeader = req.headers.authorization || req.headers.Authorization;

    if (!rawAuthHeader || typeof rawAuthHeader !== "string") {
      return res.status(HttpStatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "Authorization required",
      });
    }

    const token = rawAuthHeader.split(" ")[1];
    if (!token) {
      return res.status(HttpStatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "Token missing",
      });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    } catch {
      return res.status(HttpStatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "Invalid token",
      });
    }

    if (decoded.role !== "buyer" && decoded.userType !== "Buyer") {
      return res.status(HttpStatusCodes.FORBIDDEN).json({
        success: false,
        message: "Buyer access only",
      });
    }

    const buyer = await DB.Models.Buyer.findById(decoded.id).select("-password");
    if (!buyer) {
      return res.status(HttpStatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "Buyer not found",
      });
    }

    req.buyer = buyer;
    next();
  } catch (error) {
    console.error("[BUYER AUTH] Error in buyerAuth middleware:", error);
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export default buyerAuth;
