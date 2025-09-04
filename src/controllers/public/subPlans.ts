import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { DB } from "..";
import { RouteError } from "../../common/classes";


/**
 * Fetch all subscription plans
 */
export const getAllSubscriptionPlans = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const plans = await DB.Models.SubscriptionPlan.find().sort({ createdAt: -1 }).lean();

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
    if (!plan) {
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