import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { DealSiteService } from "../../services/dealSite.service";
import { DB } from "..";
import { RouteError } from "../../common/classes";
 

// Allowed keys from DealSite
const allowedSections = [
  "theme",
  "inspectionSettings",
  "socialLinks",
  "contactVisibility",
  "featureSelection",
  "footer",
  "securitySettings",
  "publicPage",
  "paymentDetails",
] as const;

type DealSiteSection = (typeof allowedSections)[number];


/**
 * Fetch a single DealSite by its public slug
 */
export const getDealSiteDetailsBySlug = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { publicSlug } = req.params;

    if (!publicSlug) {
      return next(new RouteError(HttpStatusCodes.BAD_REQUEST, "Public slug is required"));
    }

    const dealSite = await DealSiteService.getBySlug(publicSlug);

    if (!dealSite) {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Public access page not found"));
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Public access page fetched successfully",
      data: dealSite,
    });
  } catch (err) {
    next(err);
  }
};


export const getDealSiteLogsBySlug = async (
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


export const getDealSiteDetailsByUser = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
 
    const userId = req.user?._id;
  
    const dealSite = await DealSiteService.getByAgent(userId);

    if (!dealSite) {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Public access page not found"));
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Public access page fetched successfully",
      data: dealSite,
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Get DealSite by publicSlug
 * - Ensures DealSite exists and is running
 * - If subscription expired/missing → success=false with errorCode
 */
export const getDealSiteBySlug = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { publicSlug } = req.params;

    // If slug contains a hyphen and starts with a hash/uuid-like value,
    // replace the whole thing with "surecoder"
    const normalizedSlug = /^[a-f0-9]{24,}-/i.test(publicSlug)
      ? "surecoder"
      : publicSlug;

    const dealSite = await DealSiteService.getBySlug(normalizedSlug, true);
    
    if (!dealSite) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        errorCode: "DEALSITE_NOT_FOUND",
        message: "Public access page not found",
        data: null,
      });
    }

    // Only allow running DealSites
    if (dealSite.status !== "running") {
      return res.status(HttpStatusCodes.FORBIDDEN).json({
        success: false,
        errorCode: "DEALSITE_NOT_ACTIVE",
        message: "This Public access page is not currently active.",
        data: null,
      });
    }
 
    // Check subscription of the owner of this DealSite
    const activeSubscription = await DB.Models.UserSubscriptionSnapshot.findOne({
      user: dealSite.createdBy,
      status: "active",
      expiresAt: { $gt: new Date() },
    });

    if (!activeSubscription) {
      return res.status(HttpStatusCodes.OK).json({
        success: false,
        errorCode: "SUBSCRIPTION_INVALID",
        message:
          "The agent’s subscription has expired or is missing. Some features may be unavailable.",
        data: null,
      });
    }

    // --- Handle featured properties ---
    // let featuredProperties: any[] = [];

    // if (
    //   dealSite.featureSelection &&
    //   dealSite.featureSelection.mode === "manual" &&
    //   dealSite.featureSelection.propertyIds
    // ) {

    //   // Normalize propertyIds (support string or array)
    //   let propertyIds: string[] = [];

    //   if (Array.isArray(dealSite.featureSelection.propertyIds)) {
    //     propertyIds = dealSite.featureSelection.propertyIds;
    //   } else if (typeof dealSite.featureSelection.propertyIds === "string") {
    //     propertyIds = dealSite.featureSelection.propertyIds
    //       .split(",")
    //       .map(id => id.trim())
    //       .filter(Boolean);
    //   }

    //   const listingsLimit = dealSite.listingsLimit || 6;

    //   if (propertyIds.length > 0) {
    //     featuredProperties = await DB.Models.Property.find({
    //       _id: { $in: propertyIds },
    //       isApproved: true,
    //       isAvailable: true,
    //       $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
    //     })
    //       .limit(listingsLimit)
    //       .lean();
    //   }
    // }

    // Attach featured properties to the dealSite response
    // const formattedDealSite = {
    //   ...(typeof dealSite.toObject === "function" ? dealSite.toObject() : dealSite),
    //   featuredProperties,
    // };

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: dealSite,
    });
  } catch (err) {
    next(err);
  }
};



/**
 * Fetch specific DealSite settings by section
 * Example: GET /public-access-page/:publicSlug/settings/:section
 */
export const getDealSiteSection = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => { 
  try {
    const { publicSlug, sectionName } = req.params;

    if (!publicSlug || !sectionName) {
      return next(
        new RouteError(HttpStatusCodes.BAD_REQUEST, "Public slug and section are required")
      );
    }

    const dealSite = await DealSiteService.getBySlug(publicSlug, true);

    if (!dealSite) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        errorCode: "DEALSITE_NOT_FOUND",
        message: "Public access page not found",
        data: null,
      });
    }

    if (dealSite.status !== "running") {
      return res.status(HttpStatusCodes.FORBIDDEN).json({
        success: false,
        errorCode: "DEALSITE_NOT_ACTIVE",
        message: "This Public access page is not currently active.",
        data: null,
      });
    }

    // Supported sections
    const myAllowedSections = [
      "theme",
      "inspectionSettings",
      "socialLinks",
      "contactVisibility",
      "featureSelection",
      "publicPage",
      "footer",
      "securitySettings",
      "paymentDetails",
      "about",
      "contactUs",
      "brandingSeo",
      "homeSettings",
      "support",
    ];

    if (!myAllowedSections.includes(sectionName)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        `Invalid section name. Allowed: ${myAllowedSections.join(", ")}`
      );
    }

    // ✅ Handle grouped flat fields
    if (sectionName === "brandingSeo") {
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: `Public access page section '${sectionName}' fetched successfully`,
        data: {
          title: dealSite.title,
          keywords: dealSite.keywords,
          description: dealSite.description,
          logoUrl: dealSite.logoUrl,
        },
      });
    }

    // Type-safe access
    const sectionData = (dealSite as any)[sectionName];

    if (!sectionData) {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        `No data found for section: ${sectionName}`
      );
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: `Public access page section '${sectionName}' fetched successfully`,
      data: sectionData,
    });
  } catch (err) {
    next(err);
  }
};


/**
 * GET /public-access-page/:publicSlug/featured
 * Fetch all featured properties for a DealSite
 */
export const getFeaturedProperties = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { publicSlug } = req.params;
 
    const dealSite = await DealSiteService.getBySlug(publicSlug);
    
    if (!dealSite) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        errorCode: "DEALSITE_NOT_FOUND",
        message: "Public access page not found",
        data: null,
      });
    }

    if (dealSite.status !== "running") {
      return res.status(HttpStatusCodes.FORBIDDEN).json({
        success: false,
        errorCode: "DEALSITE_NOT_ACTIVE",
        message: "This Public access page is not currently active.",
        data: null,
      });
    }

    const featured = await DealSiteService.getFeaturedProperties(dealSite);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Featured properties fetched successfully",
      data: featured,
    });
  } catch (err) {
    next(err);
  }
};
