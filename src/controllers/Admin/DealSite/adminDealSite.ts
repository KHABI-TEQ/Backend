import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";

/**
 * Admin - Get all DealSites (with pagination and optional status filter)
 */
export const adminGetAllDealSites = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      page = "1",
      limit = "20",
      status,
    } = req.query as { page?: string; limit?: string; status?: string };

    const pageNum = Math.max(parseInt(page, 10), 1);
    const limitNum = Math.max(parseInt(limit, 10), 1);
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, any> = {};
    if (status) filter.status = status;

    const projection = {
      _id: 1,
      publicSlug: 1,
      title: 1,
      keywords: 1,
      description: 1,
      logoUrl: 1,
      status: 1,
      createdBy: 1,
      createdAt: 1,
      updatedAt: 1,
    };

    const [dealSites, total] = await Promise.all([
      DB.Models.DealSite.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select(projection)
        .lean(),

      DB.Models.DealSite.countDocuments(filter),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "DealSites fetched successfully",
      data: dealSites,
      pagination: {
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        limit: limitNum,
      },
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Admin - Get DealSite stats (group by status)
 */
export const adminGetDealSiteStats = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const stats = await DB.Models.DealSite.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "DealSite stats fetched successfully",
      stats: stats.reduce(
        (acc, s) => ({ ...acc, [s._id]: s.count }),
        {} as Record<string, number>
      ),
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Admin - Get single DealSite by publicSlug
 */
export const adminGetDealSiteBySlug = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { publicSlug } = req.params;

    const dealSite = await DB.Models.DealSite.findOne({ publicSlug })
      .populate("createdBy", "email phoneNumber firstName lastName userType") // only pick these fields
      .lean();

    if (!dealSite) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "DealSite not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "DealSite fetched successfully",
      data: dealSite,
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Admin - Pause DealSite
 */
export const adminPauseDealSite = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { publicSlug } = req.params;

    const dealSite = await DB.Models.DealSite.findOneAndUpdate(
      { publicSlug },
      { status: "on-hold" },
      { new: true }
    );

    if (!dealSite) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "DealSite not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "DealSite paused successfully",
      data: dealSite,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin - Resume/Activate DealSite
 */
export const adminActivateDealSite = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { publicSlug } = req.params;

    const dealSite = await DB.Models.DealSite.findOneAndUpdate(
      { publicSlug },
      { status: "running" },
      { new: true }
    );

    if (!dealSite) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "DealSite not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "DealSite activated successfully",
      data: dealSite,
    });
  } catch (err) {
    next(err);
  }
};
