import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { DB } from "..";
import { RouteError } from "../../common/classes";

/**
 * @swagger
 * /features/getAll:
 *   get:
 *     tags:
 *       - Public
 *     summary: GET /features/getAll
 *     security: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         required: false
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         required: false
 *     responses:
 *       200:
 *         description: OK
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 * /subscriptions/plans:
 *   get:
 *     tags:
 *       - Public
 *     summary: GET /subscriptions/plans
 *     security: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         required: false
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         required: false
 *     responses:
 *       200:
 *         description: OK
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */



/**
 * Fetch all subscription plans
 */
export const getAllSubscriptionPlans = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const plans = await DB.Models.SubscriptionPlan.find({
      isTrial: { $ne: true },
      price: { $gt: 0 },
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: plans,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get one subscription plan
 */
export const getSubscriptionPlan = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { planId } = req.params;

    const plan = await DB.Models.SubscriptionPlan.findById(planId).lean();
    if (!plan || plan.isTrial || Number(plan.price) <= 0) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Plan not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: plan,
    });
  } catch (err) {
    next(err);
  }
};