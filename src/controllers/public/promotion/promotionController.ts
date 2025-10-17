import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { PromotionService } from "../../../services/promotion.service";

const promotionService = new PromotionService();

/**
 * Frontend - Get Active Promotions (for displaying ads)
 * Query params: type, limit
 */
export const getActivePromotions = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { type, limit = "3" } = req.query as Record<string, string>;
    
    // Get user info for activity tracking
    const userId = req.user?._id?.toString();
    const ipAddress = (req.ip || req.socket.remoteAddress || "").replace("::ffff:", "");
    
    const promotions = await promotionService.displayPromotions({
      type,
      limit: Math.min(parseInt(limit, 10), 10), // Max 10 promotions
      userId,
      ipAddress,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Active promotions fetched successfully",
      data: promotions,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Frontend - Get Promotions by Type
 * Params: type (banner, sidebar, popup, carousel, inline)
 */
export const getPromotionsByType = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { type } = req.params;
    const { limit = "5" } = req.query as Record<string, string>;

    const validTypes = ["banner", "sidebar", "popup", "carousel", "inline"];
    if (!validTypes.includes(type)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Invalid promotion type. Must be: banner, sidebar, popup, carousel, or inline"
      );
    }

    const promotions = await promotionService.getActivePromotionsByType(
      type,
      parseInt(limit, 10)
    );

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: `${type} promotions fetched successfully`,
      data: promotions,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Frontend - Log Promotion Click
 * Body: promotionId
 */
export const logPromotionClick = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { promotionId } = req.body;

    if (!promotionId) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "promotionId is required"
      );
    }

    const userId = req.user?._id?.toString();
    const ipAddress = (req.ip || req.socket.remoteAddress || "").replace("::ffff:", "");
    const userAgent = req.get("user-agent");

    await promotionService.logActivity({
      promotionId,
      userId,
      ipAddress,
      userAgent,
      type: "click",
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Click logged successfully",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Frontend - Log Promotion View (batch)
 * Body: promotionIds (array)
 */
export const logPromotionViews = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { promotionIds } = req.body;

    if (!Array.isArray(promotionIds) || promotionIds.length === 0) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "promotionIds array is required"
      );
    }

    const userId = req.user?._id?.toString();
    const ipAddress = (req.ip || req.socket.remoteAddress || "").replace("::ffff:", "");
    const userAgent = req.get("user-agent");

    // Log all views in parallel
    await Promise.all(
      promotionIds.map((promotionId) =>
        promotionService.logActivity({
          promotionId,
          userId,
          ipAddress,
          userAgent,
          type: "view",
        })
      )
    );

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Views logged successfully",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Frontend - Get Single Promotion Details (public view)
 */
export const getPromotionDetails = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const promotion = await promotionService.getPromotionById(id);

    if (!promotion) {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        "Promotion not found"
      );
    }

    // Only return active promotions to public
    if (promotion.status !== "active") {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        "Promotion not available"
      );
    }

    // Check date validity
    const now = new Date();
    if (promotion.startDate && promotion.startDate > now) {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        "Promotion not yet started"
      );
    }
    if (promotion.endDate && promotion.endDate < now) {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        "Promotion has expired"
      );
    }

    // Return limited fields for public view
    const publicData = {
      _id: promotion._id,
      title: promotion.title,
      description: promotion.description,
      imageUrl: promotion.imageUrl,
      redirectUrl: promotion.redirectUrl,
      type: promotion.type,
      tags: promotion.tags,
      isFeatured: promotion.isFeatured,
    };

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Promotion details fetched successfully",
      data: publicData,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Frontend - Get Featured Promotions
 */
export const getFeaturedPromotions = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { limit = "5" } = req.query as Record<string, string>;
    
    const userId = req.user?._id?.toString();
    const ipAddress = (req.ip || req.socket.remoteAddress || "").replace("::ffff:", "");

    const now = new Date();
    
    const promotions = await promotionService.displayPromotions({
      limit: Math.min(parseInt(limit, 10), 10),
      userId,
      ipAddress,
    });

    // Filter to only featured ones
    const featured = promotions.filter((p: any) => p.isFeatured === true);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Featured promotions fetched successfully",
      data: featured,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Frontend - Search Promotions (public)
 */
export const searchPromotions = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { q, type, limit = "10" } = req.query as Record<string, string>;

    if (!q || q.trim().length < 2) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Search query must be at least 2 characters"
      );
    }

    const filters = {
      status: "active",
      search: q.trim(),
      type,
    };

    const pagination = {
      page: 1,
      limit: Math.min(parseInt(limit, 10), 20),
    };

    const result = await promotionService.listPromotions(filters, pagination);

    // Filter out promotions that haven't started or have expired
    const now = new Date();
    const validPromotions = result.data.filter((promo: any) => {
      const hasStarted = !promo.startDate || promo.startDate <= now;
      const notExpired = !promo.endDate || promo.endDate >= now;
      return hasStarted && notExpired;
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Search results fetched successfully",
      data: validPromotions,
      total: validPromotions.length,
    });
  } catch (err) {
    next(err);
  }
};