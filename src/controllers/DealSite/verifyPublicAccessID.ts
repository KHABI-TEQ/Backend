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
  "marketplaceDefaults",
  "footerSection",
  "publicPage",
  "paymentDetails",
] as const;

type DealSiteSection = (typeof allowedSections)[number];


/**
 * Fetch a single DealSite by its public slug
 */
export const getDealSiteDetails = async (
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
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "DealSite not found"));
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

    const dealSite = await DealSiteService.getBySlug(publicSlug);
    
    if (!dealSite) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        errorCode: "DEALSITE_NOT_FOUND",
        message: "DealSite not found",
        data: null,
      });
    }

    // Only allow running DealSites
    if (dealSite.status !== "running") {
      return res.status(HttpStatusCodes.FORBIDDEN).json({
        success: false,
        errorCode: "DEALSITE_NOT_ACTIVE",
        message: "This DealSite is not currently active.",
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
 * Example: GET /deal-sites/:publicSlug/settings/:section
 */
export const getDealSiteSection = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { publicSlug, section } = req.params;

    if (!publicSlug || !section) {
      return next(
        new RouteError(HttpStatusCodes.BAD_REQUEST, "Public slug and section are required")
      );
    }

    const dealSite = await DealSiteService.getBySlug(publicSlug);

    if (!dealSite) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        errorCode: "DEALSITE_NOT_FOUND",
        message: "DealSite not found",
        data: null,
      });
    }

    if (dealSite.status !== "running") {
      return res.status(HttpStatusCodes.FORBIDDEN).json({
        success: false,
        errorCode: "DEALSITE_NOT_ACTIVE",
        message: "This DealSite is not currently active.",
        data: null,
      });
    }

    // ensure requested section is in whitelist
    if (!allowedSections.includes(section as DealSiteSection)) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: `Section '${section}' not found in DealSite`,
        data: null,
      });
    }

    // Type-safe access
    const sectionKey = section as DealSiteSection;
    const sectionData = dealSite[sectionKey];

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: `DealSite section '${section}' fetched successfully`,
      data: sectionData,
    });
  } catch (err) {
    next(err);
  }
};


/**
 * GET /deal-sites/:publicSlug/featured
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
        message: "DealSite not found",
        data: null,
      });
    }

    if (dealSite.status !== "running") {
      return res.status(HttpStatusCodes.FORBIDDEN).json({
        success: false,
        errorCode: "DEALSITE_NOT_ACTIVE",
        message: "This DealSite is not currently active.",
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

