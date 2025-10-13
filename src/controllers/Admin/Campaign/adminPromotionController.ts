import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { PromotionService } from "../../../services/promotion.service";

const promotionService = new PromotionService();

/**
 * Admin - Create Promotion
 */
export const adminCreatePromotion = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const payload = {
      ...req.body,
      createdBy: req.admin?._id,
    };

    const promo = await promotionService.createPromotion(payload);

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Promotion created successfully",
      data: promo,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin - Update Promotion
 */
export const adminUpdatePromotion = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const promo = await promotionService.updatePromotion(req.params.id, req.body);

    if (!promo) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Promotion not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Promotion updated successfully",
      data: promo,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin - Delete Promotion
 */
export const adminDeletePromotion = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const deleted = await promotionService.deletePromotion(req.params.id);

    if (!deleted) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Promotion not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Promotion deleted successfully",
      data: deleted,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin - List All Promotions (with pagination & filters)
 */
export const adminListPromotions = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      status,
      type,
      search,
      page = "1",
      limit = "20",
      startDate,
      endDate,
      isFeatured,
    } = req.query as Record<string, string>;

    const pagination = {
      page: Math.max(parseInt(page, 10), 1),
      limit: Math.max(parseInt(limit, 10), 1),
    };

    const filters = {
      status,
      type,
      search,
      startDate,
      endDate,
      isFeatured,
    };

    const result = await promotionService.listPromotions(filters, pagination);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Promotions fetched successfully",
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin - Get Single Promotion by ID
 */
export const adminGetPromotionById = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const promo = await promotionService.getPromotionById(req.params.id);

    if (!promo) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Promotion not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Promotion fetched successfully",
      data: promo,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin - Get Promotion Analytics (views, clicks, CTR, etc.)
 */
export const adminGetPromotionAnalytics = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const analytics = await promotionService.getPromotionAnalytics(req.params.id);

    if (!analytics) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Promotion not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Promotion analytics fetched successfully",
      data: analytics,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin - Update Promotion Status (Activate, Pause, Expire)
 */
export const adminUpdatePromotionStatus = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updated = await promotionService.updatePromotion(id, { status });

    if (!updated) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Promotion not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: `Promotion ${status} successfully`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};
