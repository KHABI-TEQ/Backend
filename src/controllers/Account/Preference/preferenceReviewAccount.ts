import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import {
  getMyReview,
  upsertReview,
} from "../../../services/preferenceReview.service";

function requireAgent(req: AppRequest) {
  const userId = req.user?._id;
  if (!userId) {
    throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Login required.");
  }
  const userType = String((req.user as any)?.userType || "");
  if (userType !== "Agent") {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "Only agents can review marketplace preferences."
    );
  }
  return String(userId);
}

/**
 * @swagger
 * /account/marketplace/preferences/{preferenceId}/review:
 *   get:
 *     tags:
 *       - Account > Preferences
 *     summary: Get agent's review for a marketplace preference
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: preferenceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Preference ID
 *     responses:
 *       200:
 *         description: Preference review loaded
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
 *                     reviewId:
 *                       type: string
 *                     preferenceId:
 *                       type: string
 *                     rating:
 *                       type: number
 *                     comment:
 *                       type: string
 *                     reviewedAt:
 *                       type: string
 *       400:
 *         description: Invalid preference id
 *       401:
 *         description: Login required
 *       403:
 *         description: Only agents can review marketplace preferences
 */
export const getMarketplacePreferenceReview = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const agentId = requireAgent(req);
    const { preferenceId } = req.params;
    const data = await getMyReview(agentId, preferenceId);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Preference review loaded.",
      data,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /account/marketplace/preferences/{preferenceId}/review:
 *   put:
 *     tags:
 *       - Account > Preferences
 *     summary: Upsert agent's review for a marketplace preference
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: preferenceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Preference ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: number
 *                 description: Rating value (1-5)
 *               comment:
 *                 type: string
 *                 description: Review comment
 *     responses:
 *       200:
 *         description: Review saved
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
 *       400:
 *         description: Invalid preference id
 *       401:
 *         description: Login required
 *       403:
 *         description: Only agents can review marketplace preferences
 */
export const upsertMarketplacePreferenceReview = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const agentId = requireAgent(req);
    const { preferenceId } = req.params;
    if (!preferenceId || !mongoose.Types.ObjectId.isValid(preferenceId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid preference id.");
    }
    const data = await upsertReview(agentId, preferenceId, req.body || {});
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Review saved.",
      data,
    });
  } catch (err) {
    next(err);
  }
};
