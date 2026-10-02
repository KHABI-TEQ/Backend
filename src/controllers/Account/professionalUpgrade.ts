import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import {
  applyProfessionalUpgrade,
  getProfessionalUpgrade,
} from "../../services/professionalUpgrade.service";

/**
 * @swagger
 * /account/professional-upgrade:
 *   post:
 *     tags:
 *       - Account > Professional
 *     summary: Apply for professional upgrade
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - professionalType
 *             properties:
 *               professionalType:
 *                 type: string
 *                 enum: [Lawyer, Surveyor, Valuer, PropertyScout]
 *                 description: Type of professional to upgrade to
 *     responses:
 *       200:
 *         description: Upgrade started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       401:
 *         description: Not authenticated
 */
export const applyMyProfessionalUpgrade = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
    }
    const data = await applyProfessionalUpgrade({
      userId: String(userId),
      professionalType: String(req.body?.professionalType || ""),
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Upgrade started. Complete professional verification to finish.",
      data,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /account/professional-upgrade:
 *   get:
 *     tags:
 *       - Account > Professional
 *     summary: Get professional upgrade status
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Professional upgrade status fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     professionalUpgradeStatus:
 *                       type: string
 *                     pendingProfessionalType:
 *                       type: string
 *                     requestedAt:
 *                       type: string
 *                     processedAt:
 *                       type: string
 *       401:
 *         description: Not authenticated
 */
export const getMyProfessionalUpgrade = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
    }
    const data = await getProfessionalUpgrade(String(userId));
    return res.status(HttpStatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
