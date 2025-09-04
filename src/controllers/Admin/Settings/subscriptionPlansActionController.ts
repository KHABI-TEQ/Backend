import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { DB } from "../..";
import { RouteError } from "../../../common/classes";

/**
 * Create a new subscription plan
 */
export const createSubscriptionPlan = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, code, price, currency, durationInDays, features } = req.body;

    // Ensure unique code
    const existing = await DB.Models.SubscriptionPlan.findOne({ code });
    
    if (existing) {
      throw new RouteError(HttpStatusCodes.CONFLICT, "Plan code already exists");
    }

    const plan = await DB.Models.SubscriptionPlan.create({
      name,
      code,
      price,
      currency,
      durationInDays,
      features,
    });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Subscription plan created successfully",
      data: plan,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update a subscription plan (except code)
 */
export const updateSubscriptionPlan = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { planId } = req.params;
    const { name, price, currency, durationInDays, features, isActive } = req.body;

    const plan = await DB.Models.SubscriptionPlan.findById(planId);
    if (!plan) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Plan not found");
    }

    // Prevent disabling if active subscriptions exist
    if (isActive === false) {
      const activeSubs = await DB.Models.Subscription.countDocuments({
        plan: plan.code,
        status: "active",
      });
      if (activeSubs > 0) {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          "Cannot disable a plan with active subscriptions"
        );
      }
    }

    // Update allowed fields only (code cannot be edited)
    plan.name = name ?? plan.name;
    plan.price = price ?? plan.price;
    plan.currency = currency ?? plan.currency;
    plan.durationInDays = durationInDays ?? plan.durationInDays;
    plan.features = features ?? plan.features;
    if (isActive !== undefined) plan.isActive = isActive;

    await plan.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Subscription plan updated successfully",
      data: plan,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a subscription plan
 */
export const deleteSubscriptionPlan = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { planId } = req.params;

    const plan = await DB.Models.SubscriptionPlan.findById(planId);
    if (!plan) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Plan not found");
    }

    // Prevent deletion if active subscriptions exist
    const activeSubs = await DB.Models.Subscription.countDocuments({
      plan: plan.code,
      status: "active",
    });
    if (activeSubs > 0) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Cannot delete a plan with active subscriptions"
      );
    }

    await plan.deleteOne();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Subscription plan deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};

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
