import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { PromotionService } from "../../../services/promotion.service";

const promotionService = new PromotionService();

/**
 * Admin - Create Promotion
 */
/**
 * @swagger
 * /admin/promotions/create:
 *   post:
 *     tags:
 *       - Admin > Campaigns
 *     summary: Create promotion
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - startDate
 *               - endDate
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               discountPercentage:
 *                 type: number
 *               targetAudience:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Promotion created successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
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
/**
 * @swagger
 * /admin/promotions/{id}/edit:
 *   patch:
 *     tags:
 *       - Admin > Campaigns
 *     summary: Update promotion
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               discountPercentage:
 *                 type: number
 *               targetAudience:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Promotion updated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Promotion not found
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
/**
 * @swagger
 * /admin/promotions/{id}/delete:
 *   delete:
 *     tags:
 *       - Admin > Campaigns
 *     summary: Delete promotion
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Promotion deleted successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Promotion not found
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
/**
 * @swagger
 * /admin/promotions/getAll:
 *   get:
 *     tags:
 *       - Admin > Campaigns
 *     summary: List all promotions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *       - name: isActive
 *         in: query
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Promotions fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               {'$ref': '#/components/schemas/Pagination'}
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
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
/**
 * @swagger
 * /admin/promotions/{id}/getOne:
 *   get:
 *     tags:
 *       - Admin > Campaigns
 *     summary: Get promotion by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Promotion fetched successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Promotion not found
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
/**
 * @swagger
 * /admin/promotions/{id}/analytics:
 *   get:
 *     tags:
 *       - Admin > Campaigns
 *     summary: Get promotion analytics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Analytics fetched successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Promotion not found
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
/**
 * @swagger
 * /admin/promotions/{id}/status:
 *   patch:
 *     tags:
 *       - Admin > Campaigns
 *     summary: Update promotion status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Promotion status updated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Promotion not found
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
