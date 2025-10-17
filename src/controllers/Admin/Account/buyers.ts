import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { AppRequest } from "../../../types/express";

// Create buyer
export const createBuyer = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { fullName, email, phoneNumber } = req.body;

    if (!fullName || !email || !phoneNumber) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Full name, email, and phone number are required"
      );
    }

    const buyer = await DB.Models.Buyer.create({ fullName, email, phoneNumber });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Buyer created successfully",
      data: buyer.toObject(),
    });
  } catch (err) {
    next(err);
  }
};

// Update buyer
export const updateBuyer = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { buyerId } = req.params;
    const updates = req.body;

    if (!mongoose.isValidObjectId(buyerId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid buyer ID");
    }

    const buyer = await DB.Models.Buyer.findByIdAndUpdate(buyerId, updates, {
      new: true,
      lean: true,
    });

    if (!buyer) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Buyer not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Buyer updated successfully",
      data: buyer,
    });
  } catch (err) {
    next(err);
  }
};

// Delete buyer
export const deleteBuyer = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { buyerId } = req.params;

    if (!mongoose.isValidObjectId(buyerId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid buyer ID");
    }

    const deleted = await DB.Models.Buyer.findByIdAndDelete(buyerId);

    if (!deleted) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Buyer not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Buyer deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};

// Get single buyer
export const getSingleBuyer = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { buyerId } = req.params;

    if (!mongoose.isValidObjectId(buyerId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid buyer ID");
    }

    const buyer = await DB.Models.Buyer.findById(buyerId).lean();

    if (!buyer) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Buyer not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Buyer fetched successfully",
      data: buyer,
    });
  } catch (err) {
    next(err);
  }
};

// Get all buyers
export const getAllBuyers = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
    } = req.query as { page?: string; limit?: string; status?: string };

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const skip = (pageNum - 1) * limitNum;

    const filter: any = {};
    if (status) filter.status = status;

    const [buyers, total] = await Promise.all([
      DB.Models.Buyer.find(filter).skip(skip).limit(limitNum).lean(),
      DB.Models.Buyer.countDocuments(filter),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Buyers fetched successfully",
      data: buyers,
      pagination: {
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        limit: limitNum,
      }
    });
  } catch (err) {
    next(err);
  }
};

// Get buyer preferences
export const getBuyerPreferences = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { buyerId } = req.params;
    const {
      page = 1,
      limit = 10,
    } = req.query as { page?: string; limit?: string };

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const skip = (pageNum - 1) * limitNum;

    if (!mongoose.isValidObjectId(buyerId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid buyer ID");
    }

    const [preferences, total] = await Promise.all([
      DB.Models.Preference.find({ buyer: buyerId }).skip(skip).limit(limitNum).lean(),
      DB.Models.Preference.countDocuments({ buyer: buyerId }),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Buyer preferences fetched successfully",
      data: preferences,
      pagination: {
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        limit: limitNum,
      }
    });
  } catch (err) {
    next(err);
  }
};
