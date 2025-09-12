import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { DB } from "../..";
import { RouteError } from "../../../common/classes";
import { PaystackService } from "../../../services/paystack.service";
import mongoose, { Types } from "mongoose";
import { generalEmailLayout } from "../../../common/emailTemplates/emailLayout";
import { generateAutoRenewalStoppedEmail, generateSubscriptionCancellationEmail } from "../../../common/emailTemplates/subscriptionMails";
import sendEmail from "../../../common/send.email";
import { UserSubscriptionSnapshotService } from "../../../services/userSubscriptionSnapshot.service";
import { SubscriptionPlanService } from "../../../services/subscriptionPlan.service";


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

    const subscriptionSnapshot = await UserSubscriptionSnapshotService.createSnapshot({
      user: userId as string,
      plan: plan._id as string,
      transaction: paymentResponse.transactionId as string,
      status: "pending",
      expiresAt: endDate,
      autoRenew: autoRenewal ?? false,
    });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Subscription initiated, redirecting to payment page",
      data: {
        subscriptionId: subscriptionSnapshot._id,
        paymentUrl: paymentResponse.authorization_url,
      },
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Fetch paginated subscription snapshots for the authenticated user
 */
export const fetchUserSubscriptions = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page = 1, limit = 10, status } = req.query as {
      page?: string;
      limit?: string;
      status?: string;
    };
    const userId = req.user?._id;

    if (!userId) {
      return res.status(HttpStatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const filters: any = { user: userId };
    if (status) filters.status = status;

    // pagination
    const skip = (Number(page) - 1) * Number(limit);
    const perPage = Number(limit);

    // fetch subscriptions with transactions + plans
    // const subscriptions = await UserSubscriptionSnapshotService.querySnapshots(filters, {
    //   sort: { createdAt: -1 },
    //   skip,
    //   limit: perPage,
    // }).populate([
    //   {
    //     path: "transaction",
    //     model: "NewTransaction",
    //     select: "reference amount status transactionType paymentMode",
    //   },
    //   {
    //     path: "planDetails",
    //     model: "SubscriptionPlan",
    //     select: "name code",
    //   },
    // ]);

    const subscriptions = await UserSubscriptionSnapshotService.querySnapshots(filters, {
      sort: { createdAt: -1 },
      skip,
      limit: perPage,
      populate: [
        {
          path: "transaction",
          select: "reference amount status transactionType paymentMode",
        },
        {
          path: "planDetails",
          select: "name code",
        },
      ],
    });


    const total = await DB.Models.UserSubscriptionSnapshot.countDocuments(filters);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: subscriptions,
      pagination: {
        total,
        page: Number(page),
        limit: perPage,
        totalPages: Math.ceil(total / perPage),
      },
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Fetch details of a single subscription snapshot for the authenticated user
 */
export const getUserSubscriptionDetails = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { subscriptionId } = req.params;
    const userId = req.user?._id;

    // Fetch the subscription snapshot directly from the model
    const subscription = await DB.Models.UserSubscriptionSnapshot.findOne({
      _id: subscriptionId,
      user: userId,
    })
      .populate({
        path: "transaction",
        select: "reference amount status transactionType paymentMode",
      })
      .populate({
        path: "plan",
        select: "name code",
      })
      .lean();

    if (!subscription) {
      return next(
        new RouteError(
          HttpStatusCodes.NOT_FOUND,
          "Subscription not found or not accessible"
        )
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
 * Cancel/Delete subscription snapshot (soft delete → mark as cancelled)
 */
export const cancelSubscriptionSnapshot = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { subscriptionId } = req.params;
    const userId = req.user?._id;

    // Fetch the snapshot
    const snapshot = await UserSubscriptionSnapshotService.getSnapshotById(subscriptionId);

    if (!snapshot || snapshot.user.toString() !== userId.toString()) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Subscription not found");
    }

    // Only allow cancellation if active or pending
    if (!["active", "pending"].includes(snapshot.status)) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Cannot cancel a subscription with status "${snapshot.status}"`,
      });
    }

    // Mark as cancelled
    snapshot.status = "cancelled";
    await snapshot.save();

    // Fetch related plan & transaction details
    const plan = await DB.Models.SubscriptionPlan.findById(snapshot.plan);
    const transaction = await DB.Models.NewTransaction.findById(snapshot.transaction);
    const user = await DB.Models.User.findById(snapshot.user);

    if (!plan || !transaction || !user) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Related plan, transaction, or user not found");
    }

    // Send cancellation email
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
 * Toggle auto-renewal for a subscription snapshot
 */
export const toggleSubscriptionSnapshotAutoRenewal = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { subscriptionId } = req.params;
    const { enable } = req.body;
    const userId = req.user?._id;

    // Fetch snapshot
    const snapshot = await UserSubscriptionSnapshotService.getSnapshotById(subscriptionId);

    if (!snapshot || snapshot.user.toString() !== userId.toString()) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Subscription not found");
    }

    // If trying to disable auto-renewal but already disabled
    if (!enable && !snapshot.autoRenew) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Auto-renewal is already disabled for this subscription",
      });
    }

    snapshot.autoRenew = !!enable;
    await snapshot.save();

    // Send email if auto-renewal disabled
    if (!enable) {
      const plan = await DB.Models.SubscriptionPlan.findById(snapshot.plan);
      const user = await DB.Models.User.findById(snapshot.user);

      if (plan && user) {
        const emailBody = generalEmailLayout(
          generateAutoRenewalStoppedEmail({
            fullName: user.fullName || `${user.firstName} ${user.lastName}`,
            planName: plan.name,
            lastBillingDate: snapshot.startedAt.toDateString(),
          })
        );

        await sendEmail({
          to: user.email,
          subject: "Auto-Renewal Stopped for Your Subscription",
          html: emailBody,
          text: emailBody,
        });
      }
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: enable
        ? "Auto-renewal enabled for this subscription"
        : "Auto-renewal disabled for this subscription and email sent",
      data: {
        subscriptionId: snapshot._id,
        autoRenew: snapshot.autoRenew,
      },
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Fetch ALl Active subscription plans
 */
export const getAllActiveSubscriptionPlans = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {  

    const plans = await SubscriptionPlanService.getAllActivePlans();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: plans,
    });
  } catch (err) {
    next(err);
  }
};

