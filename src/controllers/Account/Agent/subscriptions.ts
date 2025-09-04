import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { DB } from "../..";
import { RouteError } from "../../../common/classes";
import { PaystackService } from "../../../services/paystack.service";
import { Types } from "mongoose";
import { generalEmailLayout } from "../../../common/emailTemplates/emailLayout";
import { generateAutoRenewalStoppedEmail, generateSubscriptionCancellationEmail } from "../../../common/emailTemplates/subscriptionMails";
import sendEmail from "../../../common/send.email";


/**
 * Create a new subscription (usually after payment success)
 */
export const createSubscription = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { planCode, autoRenewal } = req.body;
    const userId = req.user?._id;

    // Ensure plan exists
    const plan = await DB.Models.SubscriptionPlan.findOne({
      code: planCode,
      isActive: true,
    });

    if (!plan) {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        "Subscription plan not found"
      );
    }

    // Generate payment link
    const paymentResponse = await PaystackService.initializePayment({
      email: req.user?.email,
      amount: plan.price,
      fromWho: {
        kind: "User",
        item: new Types.ObjectId(userId as Types.ObjectId),
      },
      transactionType: "subscription",
    });

    // Subscription shouldn't actually "start" until payment is successful
    // So we don't set startDate/endDate yet — OR we mark them but keep status pending.
    const startDate = new Date(); // this will be adjusted when payment is confirmed
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.durationInDays);

    const subscription = await DB.Models.Subscription.create({
      user: userId,
      plan: plan.code,
      status: "pending",
      startDate,
      endDate,
      transaction: paymentResponse.transactionId,
      autoRenew: autoRenewal ?? false,
    });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Subscription initiated, redirecting to payment page",
      data: {
        subscriptionId: subscription._id,
        paymentUrl: paymentResponse.authorization_url,
      },
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Fetch paginated subscriptions for the authenticated user
 */
export const fetchUserSubscriptions = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const filter: any = {
      user: req.user._id,
    };

    if (status) {
      filter.status = status;
    }

    const subscriptions = await DB.Models.Subscription.find(filter)
      .populate("transaction") // so we can see the payment reference, amount, etc.
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .sort({ createdAt: -1 })
      .lean();

    const total = await DB.Models.Subscription.countDocuments(filter);

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
 * Fetch details of a single subscription for the authenticated user
 */
export const getUserSubscriptionDetails = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { subscriptionId } = req.params;

    const subscription = await DB.Models.Subscription.findOne({
      _id: subscriptionId,
      user: req.user._id,
    })
      .populate("transaction")
      .lean();

    if (!subscription) {
      return next(
        new RouteError(HttpStatusCodes.NOT_FOUND, "Subscription not found or not accessible")
      );
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
 * Cancel/Delete subscription (soft delete → mark as cancelled)
 */
export const cancelSubscription = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { subscriptionId } = req.params;
    const userId = req.user?._id;

    const subscription = await DB.Models.Subscription.findOne({
      _id: subscriptionId,
      user: userId,
    })
    .populate({
        path: "transaction",
        model: "newTransaction",
        select: "reference amount status transactionType paymentMode",
    })
    .populate({
      path: "user",
      select: "firstName lastName email fullName",
    });

    if (!subscription) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Subscription not found");
    }

    // Only allow cancellation if subscription is active or pending
    if (subscription.status !== "active" && subscription.status !== "pending") {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Cannot cancel a subscription with status "${subscription.status}"`,
      });
    }

    // Ensure plan exists
    const plan = await DB.Models.SubscriptionPlan.findOne({
      code: subscription.plan,
      isActive: true,
    });

    if (!plan) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            "The subscription plan associated with this subscription was not found"
        );
    }

    // Mark subscription as cancelled
    subscription.status = "cancelled";
    await subscription.save();

    // Send cancellation email
    const user = subscription.user as any;
    const transaction = subscription.transaction as any;

    const emailBody = generalEmailLayout(
      generateSubscriptionCancellationEmail({
        fullName: user.fullName || `${user.firstName} ${user.lastName}`,
        planName: plan.name,
        amount: transaction.amount || 0,
        transactionRef: transaction.reference,
        cancelledDate: new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      })
    );

    await sendEmail({
      to: user.email,
      subject: "Your Subscription Has Been Cancelled",
      html: emailBody,
      text: emailBody,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Subscription cancelled successfully and email sent",
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Toggle auto-renewal for a subscription
 */
export const toggleSubscriptionAutoRenewal = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { subscriptionId } = req.params;
    const { enable } = req.body;
    const userId = req.user?._id;
 
    const subscription = await DB.Models.Subscription.findOne({
      _id: subscriptionId,
      user: userId,
    }).populate({
      path: "user",
      select: "firstName lastName fullName email",
    });

    if (!subscription) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Subscription not found");
    }

    // Ensure plan exists
    const plan = await DB.Models.SubscriptionPlan.findOne({
      code: subscription.plan,
      isActive: true,
    });

    if (!plan) {
        throw new RouteError(
            HttpStatusCodes.NOT_FOUND,
            "The subscription plan associated with this subscription was not found"
        );
    }

    // If trying to disable auto-renewal but it's already disabled
    if (!enable && !subscription.autoRenew) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Auto-renewal is already disabled for this subscription",
      });
    }

    subscription.autoRenew = !!enable;
    await subscription.save();

    // Send email if auto-renewal was disabled
    if (!enable) {
      const user = subscription.user as any;
      const emailBody = generalEmailLayout(
        generateAutoRenewalStoppedEmail({
          fullName: user.fullName || `${user.firstName} ${user.lastName}`,
          planName: plan.name,
          lastBillingDate: subscription.startDate.toDateString(),
        })
      );

      await sendEmail({
        to: user.email,
        subject: "Auto-Renewal Stopped for Your Subscription",
        html: emailBody,
        text: emailBody,
      });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: enable
        ? "Auto-renewal enabled for this subscription"
        : "Auto-renewal disabled for this subscription and email sent",
      data: {
        subscriptionId: subscription._id,
        autoRenew: subscription.autoRenew,
      },
    });
  } catch (err) {
    next(err);
  }
};

