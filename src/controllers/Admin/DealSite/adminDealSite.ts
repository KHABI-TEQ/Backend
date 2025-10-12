import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { dealSiteActivityService } from "../../../services/dealSiteActivity.service";


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

    // 🔹 Add publicPageUrl to each dealSite
    const baseDomain = "https://khabiteq.com"; // <-- centralize base domain
    const formattedDealSites = dealSites.map((site) => ({
      ...site,
      publicPageUrl: `https://${site.publicSlug}.${baseDomain.replace(/^https?:\/\//, "")}/`,
    }));

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Public access pages fetched successfully",
      data: formattedDealSites,
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
      message: "Public access page stats fetched successfully",
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
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Public access page not found");
    }

    // 🔹 Add publicPageUrl
    const baseDomain = "https://khabiteq.com"; // consider moving to env var
    const publicPageUrl = `https://${dealSite.publicSlug}.${baseDomain.replace(/^https?:\/\//, "")}/`;

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Public access page fetched successfully",
      data: {
        ...dealSite,
        publicPageUrl,
      },
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
      { status: "paused" },
      { new: true }
    );

    if (!dealSite) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Public access page not found");
    }

    await dealSiteActivityService.logActivity({
      dealSiteId: dealSite._id.toString(),
      actorId: req.admin._id,
      actorModel: "Admin",
      category: "deal-paused",
      action: "Paused Public access page",
      description: "Admin temporarily paused the Public access page due to verification review",
      req,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Public access page paused successfully",
      data: dealSite,
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Admin - Pause DealSite
 */
export const adminPutOnHoldDealSite = async (
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
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Public access page not found");
    }

    await dealSiteActivityService.logActivity({
      dealSiteId: dealSite._id.toString(),
      actorId: req.admin._id,
      actorModel: "Admin",
      category: "deal-onHold",
      action: "Public access page placed on hold",
      description: "An admin placed this public access page on hold pending further review.",
      req,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Public access page Put on Hold successfully",
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
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Public access page not found");
    }

    await dealSiteActivityService.logActivity({
      dealSiteId: dealSite._id.toString(),
      actorId: req.admin._id,
      actorModel: "Admin",
      category: "deal-resumed",
      action: "Public access page resumed",
      description: "An admin resumed this Public access page after completing the necessary review.",
      req,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Public access page activated successfully",
      data: dealSite,
    });
  } catch (err) {
    next(err);
  }
};



/**
 * Admin - Get all reports for a DealSite (by publicSlug)
 */
export const adminGetDealSiteReports = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { publicSlug } = req.params;
    const { page = "1", limit = "20", status } = req.query as {
      page?: string;
      limit?: string;
      status?: string;
    };

    const pageNum = Math.max(parseInt(page, 10), 1);
    const limitNum = Math.max(parseInt(limit, 10), 1);
    const skip = (pageNum - 1) * limitNum;

    // 🔹 Ensure the DealSite exists
    const dealSite = await DB.Models.DealSite.findOne({ publicSlug })
      .select("_id title publicSlug")
      .lean();

    if (!dealSite) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Public access page not found");
    }

    // 🔹 Build report filter
    const filter: Record<string, any> = { dealSite: dealSite._id };
    if (status) filter.status = status;

    // 🔹 Fetch reports with pagination
    const [reports, total] = await Promise.all([
      DB.Models.DealSiteReport.find(filter)
        .populate("reportedBy", "firstName lastName email phoneNumber userType")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      DB.Models.DealSiteReport.countDocuments(filter),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Public access page reports fetched successfully",
      data: reports,
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
 * Admin - Get all activities for a DealSite (by publicSlug)
 */
export const adminGetDealSiteActivities = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { publicSlug } = req.params;
    const { page = "1", limit = "20", category } = req.query as {
      page?: string;
      limit?: string;
      category?: string;
    };

    const pageNum = Math.max(parseInt(page, 10), 1);
    const limitNum = Math.max(parseInt(limit, 10), 1);
    const skip = (pageNum - 1) * limitNum;

    // 🔹 Ensure the DealSite exists
    const dealSite = await DB.Models.DealSite.findOne({ publicSlug })
      .select("_id title publicSlug")
      .lean();

    if (!dealSite) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Public access page not found");
    }

    // 🔹 Build filter
    const filter: Record<string, any> = { dealSite: dealSite._id };
    if (category) filter.category = category;

    // 🔹 Fetch activities with pagination
    const [activities, total] = await Promise.all([
      DB.Models.DealSiteActivity.find(filter)
        .populate("actor", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),

      DB.Models.DealSiteActivity.countDocuments(filter),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Public access page activities fetched successfully",
      data: activities,
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

