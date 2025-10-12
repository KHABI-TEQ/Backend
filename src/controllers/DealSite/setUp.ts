import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { DealSiteService } from "../../services/dealSite.service";
import { PaystackService } from "../../services/paystack.service";
import { dealSiteActivityService } from "../../services/dealSiteActivity.service";
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

    await dealSiteActivityService.logActivity({
      dealSiteId: dealSite._id.toString(),
      actorId: req.user._id,
      actorModel: "User",
      category: "deal-setUp",
      action: "Updated public access page setup",
      description: "User customized the homepage layout and visuals for their public access page.",
      req,
    });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Public access page created successfully",
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



/**
 * Check availability of a DealSite slug
 */
export const bankList = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await PaystackService.getBankList();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};


