import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { EmailSubscriptionService } from "../../services/emailSubscription.service";

/**
 * Subscribe to email list
 */
export const subscribeEmail = async (
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
      message: "Successfully subscribed",
      data: subscription,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Unsubscribe from email list
 */
export const unsubscribeEmail = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.query; // can be query param from link

    if (!email || typeof email !== "string") {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Email is required");
    }

    const subscription = await EmailSubscriptionService.unsubscribe(email);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Successfully unsubscribed",
      data: subscription,
    });
  } catch (err) {
    next(err);
  }
};
