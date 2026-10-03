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
import { UserSubscriptionSnapshotService } from "../../../services/userSubscriptionSnapshot.service";
import { SubscriptionPlanService } from "../../../services/subscriptionPlan.service";
import { PlanFeatureService } from "../../../services/planFeatures.service";
import {
  computePaidSubscriptionExpiresAt,
  resolveAgentSubscriptionBonusDays,
} from "../../../services/agentSubscriptionIncentive.service";
import {
  isUnlimitedListingPlanCode,
  listingLimitForPlanCode,
} from "../../../common/constants/publisherListingLimits";
import {
  isWhiteLabelingCategory,
  SUBSCRIPTION_PLAN_AUDIENCES,
  SUBSCRIPTION_PLAN_CATEGORIES,
  type SubscriptionPlanCategory,
} from "../../../common/constants/subscriptionCategories";
import {
  resolveCatalogAudienceForUser,
  assertUserCanPurchasePlanAudience,
} from "../../../services/subscriptionPlanAudience.service";
import { catalogDefinitionByCode } from "../../../common/constants/subscriptionCatalog";


/**
 * @swagger
 * /account/subscriptions/makeSub:
 *   post:
 *     tags:
 *       - Account > Agent
 *     summary: Create a new subscription
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planCode
 *             properties:
 *               planCode:
 *                 type: string
 *                 description: Subscription plan code
 *               autoRenewal:
 *                 type: boolean
 *                 description: Enable auto-renewal
 *     responses:
 *       201:
 *         description: Subscription initiated, redirecting to payment page
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
 *                   properties:
 *                     authorizationUrl:
 *                       type: string
 *                     accessCode:
 *                       type: string
 *                     reference:
 *                       type: string
 *       400:
 *         description: Plan code is required or invalid plan
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Only registered professionals can create subscriptions or KYC not approved
 */
export const createSubscription = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { planCode, autoRenewal } = req.body;
    const userId = req.user?._id;
    const userType = (req.user as any)?.userType;

    const canSubscribe = [
      "Agent",
      "Developer",
      "Landowners",
      "PropertyScout",
      "Lawyer",
      "Surveyor",
      "Valuer",
    ].includes(String(userType || ""));
    if (!canSubscribe) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Only registered professionals can create subscriptions."
      );
    }

    if (userType === "Agent") {
      const agentAccount = await DB.Models.Agent.findOne({ userId });
      if (!agentAccount) {
        throw new RouteError(HttpStatusCodes.NOT_FOUND, "Only registered agents can create subscriptions.");
      }
    }


    if (!planCode) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Plan code is required");
    }

    if (userType === "Landowners") {
      const def = catalogDefinitionByCode(planCode);
      const isDistribution =
        def?.group === "developer-distribution" ||
        String(planCode || "").toUpperCase().includes("DISTRIBUTION");
      if (!isDistribution) {
        throw new RouteError(
          HttpStatusCodes.FORBIDDEN,
          "Property owner accounts use the Property Distribution plan."
        );
      }
    }

    let resolved;
    try {
      resolved = await SubscriptionPlanService.resolveActivePlanByCode(planCode);
    } catch (err: any) {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        err?.message || "Subscription plan not found"
      );
    }

    if (isWhiteLabelingCategory(resolved.category)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Custom Domain / White Labeling plans are purchased from the custom domain page."
      );
    }

    await assertUserCanPurchasePlanAudience({
      userId: String(userId),
      planAudience: (resolved.plan as any).audience,
      planCode: resolved.planCode,
    });

    const {
      plan,
      planType,
      appliedPlanName,
      price,
      durationInDays,
      planCode: resolvedCode,
      category,
      benefits,
    } = resolved;

    if (isUnlimitedListingPlanCode(resolvedCode)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Portfolio Unlimited is no longer available. Choose a Licensed Agent plan."
      );
    }

    const explicitListingLimit =
      planType === "discounted"
        ? plan.discountedPlans?.find(
            (dp) => String(dp.code || "").toUpperCase() === resolvedCode
          )?.listingLimit
        : (plan as { listingLimit?: number }).listingLimit;
    const listingLimit = listingLimitForPlanCode(resolvedCode, explicitListingLimit);

    // 3. Generate payment link
    const paymentResponse = await PaystackService.initializePayment({
      email: req.user?.email,
      amount: price,
      fromWho: {
        kind: "User",
        item: new Types.ObjectId(userId as Types.ObjectId),
      },
      transactionType: "subscription",
      metadata: {
        category,
        planCode: resolvedCode,
        planType,
      },
    });

    // 4. Create subscription snapshot (pending until payment success)
    const startDate = new Date();
    const { expiresAt: endDate } = computePaidSubscriptionExpiresAt({
      startDate,
      baseDurationInDays: durationInDays,
      planName: appliedPlanName,
      planCode: resolvedCode,
      category,
    });
 
    const subscriptionSnapshot =
      await UserSubscriptionSnapshotService.createSnapshot({
        user: userId as string,
        plan: plan._id as string,
        transaction: paymentResponse.transactionId as string,
        status: "pending",
        expiresAt: endDate,
        autoRenew: autoRenewal ?? false,
        meta: {
          planType,
          planCode: resolvedCode,
          appliedPlanName,
          durationInDays,
          category,
          benefits,
          bonusDays: 0,
          baseDurationInDays: durationInDays,
          listingLimit,
        },
      });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Subscription initiated, redirecting to payment page",
      data: {
        subscriptionId: subscriptionSnapshot._id,
        paymentUrl: paymentResponse.authorization_url,
        planName: appliedPlanName,
        amount: price,
        planType,
        category,
        benefits,
        expiresAt: endDate,
      },
    });
  } catch (err) {
    next(err);
  }
};



/**
 * @swagger
 * /account/subscriptions/fetchAll:
 *   get:
 *     tags:
 *       - Account > Agent
 *     summary: Fetch user's subscriptions with pagination
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by subscription status
 *     responses:
 *       200:
 *         description: Subscriptions fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 */
export const fetchUserSubscriptions = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page = 1, limit = 10, status, category } = req.query as {
      page?: string;
      limit?: string;
      status?: string;
      category?: string;
    };

    const userId = req.user?._id;

    await UserSubscriptionSnapshotService.stripComplimentaryBonusValidity(String(userId));

    // 👇 STEP 1: expire outdated subscriptions for this user
    await DB.Models.UserSubscriptionSnapshot.updateMany(
      {
        user: userId,
        status: "active",
        expiresAt: { $lt: new Date() },
      },
      { $set: { status: "expired" } }
    );

    // 👇 STEP 2: build filters
    const filters: any = {
      user: userId,
      status: { $nin: ["pending"] },
    };

    if (status) filters.status = status;
    const rawCategory = String(category || "").trim().toLowerCase();
    if (rawCategory === "white-labeling" || rawCategory === "custom-domain") {
      filters["meta.category"] = SUBSCRIPTION_PLAN_CATEGORIES.WHITE_LABELING;
    } else if (rawCategory === "standard") {
      filters["meta.category"] = { $nin: [SUBSCRIPTION_PLAN_CATEGORIES.WHITE_LABELING] };
    }

    // pagination
    const skip = (Number(page) - 1) * Number(limit);
    const perPage = Number(limit);

    // 👇 STEP 3: fetch subscriptions
    const subscriptions =
      await UserSubscriptionSnapshotService.querySnapshots(filters, {
        sort: { createdAt: -1 },
        skip,
        limit: perPage,
        populate: [
          {
            path: "transaction",
            select: "reference amount status transactionType paymentMode",
          },
          {
            path: "plan",
            select: "name code category audience benefits billingInterval",
          },
        ],
      });

    const total =
      await DB.Models.UserSubscriptionSnapshot.countDocuments(filters);

    const now = new Date();
    const data = subscriptions.map((row: any) => {
      const item = typeof row.toObject === "function" ? row.toObject() : { ...row };
      if (item.expiresAt && new Date(item.expiresAt) < now && item.status === "active") {
        item.status = "expired";
      }
      if (item.meta) {
        item.meta = { ...item.meta, bonusDays: 0 };
      }
      return item;
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data,
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
 * @swagger
 * /account/subscriptions/{subscriptionId}:
 *   get:
 *     tags:
 *       - Account > Agent
 *     summary: Get single subscription details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subscriptionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription ID
 *     responses:
 *       200:
 *         description: Subscription fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       404:
 *         description: Subscription not found or not accessible
 */
export const getUserSubscriptionDetails = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { subscriptionId } = req.params;
    const userId = req.user?._id;

    await UserSubscriptionSnapshotService.stripComplimentaryBonusValidity(String(userId));

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
        select: "name code category audience benefits billingInterval",
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
 * @swagger
 * /account/subscriptions/{subscriptionId}/cancel:
 *   post:
 *     tags:
 *       - Account > Agent
 *     summary: Cancel subscription snapshot
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subscriptionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription ID
 *     responses:
 *       200:
 *         description: Subscription cancelled successfully and email sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Cannot cancel a subscription with this status
 *       404:
 *         description: Subscription not found
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
 * @swagger
 * /account/subscriptions/{subscriptionId}/cancelAutoRenewal:
 *   post:
 *     tags:
 *       - Account > Agent
 *     summary: Toggle auto-renewal for subscription
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subscriptionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - enable
 *             properties:
 *               enable:
 *                 type: boolean
 *                 description: Enable or disable auto-renewal
 *     responses:
 *       200:
 *         description: Auto-renewal toggled successfully
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
 *         description: Auto-renewal is already disabled
 *       404:
 *         description: Subscription not found
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
 * @swagger
 * /account/subscriptions/fetchAllPlans:
 *   get:
 *     tags:
 *       - Account > Agent
 *     summary: Fetch all active subscription plans
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by plan category
 *       - in: query
 *         name: audience
 *         schema:
 *           type: string
 *         description: Filter by plan audience
 *     responses:
 *       200:
 *         description: Active subscription plans fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       code:
 *                         type: string
 *                       name:
 *                         type: string
 *                       category:
 *                         type: string
 *                       audience:
 *                         type: string
 *                       price:
 *                         type: number
 *                       currency:
 *                         type: string
 *                       interval:
 *                         type: string
 *                       features:
 *                         type: array
 *                         items:
 *                           type: string
 */
export const getAllActiveSubscriptionPlans = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const rawCategory = String(req.query.category || SUBSCRIPTION_PLAN_CATEGORIES.STANDARD)
      .trim()
      .toLowerCase();
    const category: SubscriptionPlanCategory | "all" =
      rawCategory === "all"
        ? "all"
        : rawCategory === "white-labeling" || rawCategory === "custom-domain"
          ? SUBSCRIPTION_PLAN_CATEGORIES.WHITE_LABELING
          : SUBSCRIPTION_PLAN_CATEGORIES.STANDARD;

    const rawAudience = String(req.query.audience || "").trim().toLowerCase();
    const audience =
      rawAudience === "all"
        ? "all" as const
        : rawAudience === "scout"
          ? SUBSCRIPTION_PLAN_AUDIENCES.SCOUT
          : rawAudience === "developer"
            ? SUBSCRIPTION_PLAN_AUDIENCES.DEVELOPER
          : rawAudience === "lawyer"
            ? SUBSCRIPTION_PLAN_AUDIENCES.LAWYER
          : rawAudience === "surveyor"
            ? SUBSCRIPTION_PLAN_AUDIENCES.SURVEYOR
          : rawAudience === "valuer"
            ? SUBSCRIPTION_PLAN_AUDIENCES.VALUER
          : rawAudience === "licensed"
            ? SUBSCRIPTION_PLAN_AUDIENCES.LICENSED
            : await resolveCatalogAudienceForUser(req.user?._id ? String(req.user._id) : null);

    const catalogOnly = category !== SUBSCRIPTION_PLAN_CATEGORIES.WHITE_LABELING;
    const plans = await SubscriptionPlanService.getAllActivePlans({
      category,
      audience,
      catalogOnly,
    });

    const enriched = (plans as any[]).map((plan) => {
      const catalog = SubscriptionPlanService.enrichPlanForCatalog(plan);
      const bonusDays = resolveAgentSubscriptionBonusDays({
        planName: plan.name,
        planCode: plan.code,
        durationInDays: plan.durationInDays,
        category: catalog.category,
      });
      const discountedPlans = (catalog.discountedPlans || []).map((dp: any) => ({
        ...dp,
        bonusDays: resolveAgentSubscriptionBonusDays({
          planName: dp.name ?? plan.name,
          planCode: dp.code,
          durationInDays: dp.durationInDays,
          category: catalog.category,
        }),
      }));
      return {
        ...catalog,
        bonusDays,
        discountedPlans,
      };
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: enriched,
      meta: {
        category,
        categoryLabel:
          category === "all"
            ? "All"
            : category === SUBSCRIPTION_PLAN_CATEGORIES.WHITE_LABELING
              ? "Custom Domain / White Labeling"
              : "Standard",
        audience,
        audienceLabel:
          audience === "all"
            ? "All"
            : audience === SUBSCRIPTION_PLAN_AUDIENCES.SCOUT
              ? "Property Scout"
              : audience === SUBSCRIPTION_PLAN_AUDIENCES.DEVELOPER
                ? "Developer / Property Owner"
              : audience === SUBSCRIPTION_PLAN_AUDIENCES.LAWYER
                ? "Lawyer"
              : audience === SUBSCRIPTION_PLAN_AUDIENCES.SURVEYOR
                ? "Surveyor"
              : audience === SUBSCRIPTION_PLAN_AUDIENCES.VALUER
                ? "Valuer"
              : "Licensed Agent",
        title: "Choose a plan",
        groups: SubscriptionPlanService.catalogGroupsMeta(),
      },
    });
  } catch (err) {
    next(err);
  }
};


/**
 * @swagger
 * /account/features/getAll:
 *   get:
 *     tags:
 *       - Account > Agent
 *     summary: Fetch all active features
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active features fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       code:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       category:
 *                         type: string
 */
export const getAllActiveFeatures = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {  

    const features = await PlanFeatureService.getAllFeatures(true);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: features,
    });
  } catch (err) {
    next(err);
  }
};
