import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { DealSiteService } from "../../services/dealSite.service";
/**
 * Create a new DealSite for an agent
 */
export const createDealSite = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;

    const dealSite = await DealSiteService.setUpPublicAccess(userId, req.body);

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "DealSite created successfully",
      data: dealSite,
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Check availability of a DealSite slug
 */
export const checkSlugAvailability = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { publicSlug } = req.body; // or req.query.slug

    const result = await DealSiteService.isSlugAvailable(publicSlug);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};


