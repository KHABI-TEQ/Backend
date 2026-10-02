import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { DealSiteService } from "../../services/dealSite.service";
import { PaystackService } from "../../services/paystack.service";
import { dealSiteActivityService } from "../../services/dealSiteActivity.service";
/**
 * Create a new DealSite (public access page) for an Agent or Developer.
 */
/**
 * @swagger
 * /account/dealSite/setUp:
 *   post:
 *     tags:
 *       - Account > DealSite
 *     summary: Create deal site
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - publicSlug
 *               - template
 *             properties:
 *               publicSlug:
 *                 type: string
 *                 description: Unique public slug for deal site
 *               template:
 *                 type: string
 *                 description: Template name
 *               customDomain:
 *                 type: string
 *                 description: Custom domain
 *               settings:
 *                 type: object
 *                 description: Deal site settings
 *     responses:
 *       201:
 *         description: Deal site created successfully
 *       400:
 *         description: Invalid request or slug already taken
 *       401:
 *         description: Not authenticated
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
/**
 * @swagger
 * /account/dealSite/slugAvailability:
 *   post:
 *     tags:
 *       - Account > DealSite
 *     summary: Check deal site slug availability
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - publicSlug
 *             properties:
 *               publicSlug:
 *                 type: string
 *                 description: Slug to check
 *     responses:
 *       200:
 *         description: Slug availability checked
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Not authenticated
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
/**
 * @swagger
 * /account/dealSite/bankList:
 *   get:
 *     tags:
 *       - Account > DealSite
 *     summary: Get bank list for deal site
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bank list fetched successfully
 *       401:
 *         description: Not authenticated
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


