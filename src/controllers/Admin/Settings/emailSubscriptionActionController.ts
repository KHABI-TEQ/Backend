import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { DB } from "../..";
import { EmailSubscriptionService } from "../../../services/emailSubscription.service";

/**
 * Admin - Fetch all email subscriptions
 */
export const adminGetAllSubscriptions = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const subscriptions = await EmailSubscriptionService.getSubscriptions(
      Number(page),
      Number(limit),
      status as string
    );

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      ...subscriptions,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin - Add a new subscription manually
 */
export const adminAddSubscription = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, firstName, lastName } = req.body;

    if (!email) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Email is required");
    }

    const subscription = await EmailSubscriptionService.subscribe({
      email,
      firstName,
      lastName,
    });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Subscription added successfully",
      data: subscription,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin - Delete subscription by ID
 */
export const adminDeleteSubscription = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { subscriptionId } = req.params;

    const deleted = await DB.Models.EmailSubscription.findByIdAndDelete(subscriptionId);

    if (!deleted) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Subscription not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Subscription deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin - Change subscription status
 */
export const adminChangeSubscriptionStatus = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { subscriptionId } = req.params;
    const { status } = req.body; // expected: "subscribed" | "unsubscribed"

    if (!["subscribed", "unsubscribed"].includes(status)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid status value");
    }

    const updated = await DB.Models.EmailSubscription.findByIdAndUpdate(
      subscriptionId,
      { status },
      { new: true }
    ).lean();

    if (!updated) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Subscription not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Subscription status updated",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};
