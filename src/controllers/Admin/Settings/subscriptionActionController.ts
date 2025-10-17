import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { DB } from "../..";
import { RouteError } from "../../../common/classes";

/**
 * Fetch all subscriptions for the authenticated user
 */
export const fetchUserSubscriptions = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const userId = req.user?._id;

    const filter: any = {};
    if (status) filter.status = status;

    const subscriptions = await DB.Models.UserSubscriptionSnapshot.find(filter)
      .populate("transaction")
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .sort({ createdAt: -1 })
      .lean();

    const total = await DB.Models.UserSubscriptionSnapshot.countDocuments(filter);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: subscriptions,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Fetch single subscription
 */
export const getSubscriptionDetails = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { subscriptionId } = req.params;
  
    const subscription = await DB.Models.UserSubscriptionSnapshot.findOne({
      _id: subscriptionId,
    })
      .populate("transaction")
      .lean();

    if (!subscription) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Subscription not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: subscription,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update subscription (status, autoRenew, dates)
 */
export const updateSubscription = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { subscriptionId } = req.params;
    const { status, autoRenew, endDate } = req.body;

    const subscription = await DB.Models.UserSubscriptionSnapshot.findOne({
      _id: subscriptionId,
    });
    if (!subscription) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Subscription not found");
    }

    if (status) subscription.status = status;
    if (autoRenew !== undefined) subscription.autoRenew = autoRenew;
    if (endDate) subscription.expiresAt = new Date(endDate);

    await subscription.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Subscription updated successfully",
      data: subscription,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Cancel/Delete subscription (soft delete → mark as cancelled)
 */
export const cancelSubscription = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { subscriptionId } = req.params;

    const subscription = await DB.Models.UserSubscriptionSnapshot.findOne({
      _id: subscriptionId,
    });
    
    if (!subscription) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Subscription not found");
    }

    subscription.status = "cancelled";
    await subscription.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Subscription cancelled successfully",
    });
  } catch (err) {
    next(err);
  }
};
