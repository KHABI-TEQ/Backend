import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { EmailSubscriptionService } from "../../services/emailSubscription.service";
import { DealSiteService } from "../../services/dealSite.service";

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

export const subscribeEmailDealSite = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {

    const { publicSlug } = req.params;

    // ✅ Ensure dealSite exists
    const dealSite = await DealSiteService.getBySlug(publicSlug);

    if (!dealSite) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Public access page not found",
      });
    }

    const { email } = req.body;

    if (!email) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Email is required");
    }

    const subscription = await EmailSubscriptionService.subscribeDealSite({
      email,
      receiverMode: {
        type: "dealSite",
        dealSiteID: dealSite._id as any
      },
      dealSite
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
