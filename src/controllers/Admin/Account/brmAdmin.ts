import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { AppRequest } from "../../../types/express";
import { getBrmBookCounts } from "../../../services/brmPractitionerJourney.service";

export const listBrmsAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      active,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.fullName = { $regex: String(search), $options: "i" };
    }
    if (active === "true") filter.isActive = true;
    if (active === "false") filter.isActive = false;

    const skip = (+page - 1) * +limit;
    const sortField = String(sortBy);
    const sortDir = order === "asc" ? 1 : -1;

    const [items, total] = await Promise.all([
      DB.Models.BusinessRelationManager.find(filter)
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(+limit)
        .lean(),
      DB.Models.BusinessRelationManager.countDocuments(filter),
    ]);

    const bookCounts = await getBrmBookCounts(items.map((item) => String(item._id)));
    const data = items.map((item) => {
      const book = bookCounts.get(String(item._id)) || { total: 0, byRole: {} };
      return { ...item, book };
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data,
      pagination: {
        page: +page,
        limit: +limit,
        total,
        totalPages: Math.ceil(total / +limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getBrmAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid BRM id");
    }
    const brm = await DB.Models.BusinessRelationManager.findById(id).lean();
    if (!brm) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "BRM not found");
    }
    const bookCounts = await getBrmBookCounts([String(brm._id)]);
    const book = bookCounts.get(String(brm._id)) || { total: 0, byRole: {} };
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: { ...brm, book },
    });
  } catch (err) {
    next(err);
  }
};

export const createBrmAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const brm = await DB.Models.BusinessRelationManager.create({
      fullName: String(req.body.fullName).trim(),
      profilePicture: String(req.body.profilePicture).trim(),
      phoneNumber: String(req.body.phoneNumber).trim(),
      gender: req.body.gender,
      serviceMessage: String(req.body.serviceMessage).trim(),
      isActive: req.body.isActive !== false,
    });
    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "BRM created successfully",
      data: brm,
    });
  } catch (err) {
    next(err);
  }
};

export const updateBrmAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid BRM id");
    }

    const updates: Record<string, unknown> = {};
    for (const key of [
      "fullName",
      "profilePicture",
      "phoneNumber",
      "gender",
      "serviceMessage",
      "isActive",
    ] as const) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const updated = await DB.Models.BusinessRelationManager.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

    if (!updated) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "BRM not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "BRM updated successfully",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteBrmAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid BRM id");
    }

    const updated = await DB.Models.BusinessRelationManager.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!updated) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "BRM not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "BRM deactivated successfully",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};
