import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { DB } from "..";
import { DealSiteService } from "../../services/dealSite.service";

/**
 * Update a DealSite
 */
export const updateDealSite = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { publicSlug } = req.params;
    const userId = req.user?._id;

    const updated = await DealSiteService.updateDealSiteDetails(
      userId,
      publicSlug,
      req.body
    );

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "DealSite updated successfully",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}; 

/**
 * Disable (pause) a DealSite
 */
export const disableDealSite = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { publicSlug } = req.params;
    const userId = req.user?._id;

    const result = await DealSiteService.disableDealSite(userId, publicSlug);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "DealSite disabled successfully",
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Enable a DealSite
 */
export const enableDealSite = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { publicSlug } = req.params;
    const userId = req.user?._id;

    const result = await DealSiteService.enableDealSite(userId, publicSlug);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "DealSite enabled successfully",
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a DealSite
 */
export const deleteDealSite = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { publicSlug } = req.params;
    const userId = req.user?._id;

    const result = await DealSiteService.deleteDealSite(userId, publicSlug);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Create Contact Us message for DealSite
 */
export const createDealSiteContactUs = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { publicSlug } = req.params;

    // ✅ Ensure dealSite exists
    const dealSite = await DealSiteService.getBySlug(publicSlug);
    if (!dealSite) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "DealSite not found",
      });
    }

    const { name, email, phoneNumber, whatsAppNumber, subject, message } =
      req.body;

    // ✅ Create Contact Us record
    const contact = await DB.Models.ContactUs.create({
      name,
      email,
      phoneNumber,
      whatsAppNumber,
      subject,
      message,
      status: "pending",
      receiverMode: {
        type: "dealSite",
        dealSiteSlug: dealSite._id,
      },
    });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Your inquiry has been submitted successfully",
      data: contact,
    });
  } catch (err) {
    next(err);
  }
};
