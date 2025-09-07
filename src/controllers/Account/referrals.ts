import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { DB } from "..";
import { RouteError } from "../../common/classes";
import { SystemSettingService } from "../../services/systemSetting.service";

/**
 * Fetch paginated referral records for the authenticated user
 */
export const fetchReferralRecords = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    const userReferralCode = req.user?.referralCode;

    const { page = 1, limit = 10, userType, accountStatus } = req.query;

    // Ensure referral system is enabled
    const referralStatusSettings = await SystemSettingService.getSetting("referral_enabled");
    if (!referralStatusSettings?.value) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Sorry referral system is turned off."
      );
    }

    // Fetch referral points from system settings
    const referralRegisteredPoints = await SystemSettingService.getSetting("referral_register_price");
    const referralSubscribedPoints = await SystemSettingService.getSetting("referral_subscribed_agent_point");

    // Build filters
    const filters: any = {
      referredBy: userReferralCode,
      isDeleted: false,
    };
    if (userType) filters.userType = userType;
    if (accountStatus) {
      if (accountStatus === "pending") {
        filters.accountApproved = false;
      } else if (accountStatus === "verified") {
        filters.isAccountVerified = true;
      } else if (accountStatus === "subscribed") {
        // handled separately below with aggregation
      }
    }

    // Query with pagination
    const skip = (Number(page) - 1) * Number(limit);

    const [records, total] = await Promise.all([
      DB.Models.User.find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),

      DB.Models.User.countDocuments(filters),
    ]);

    // Attach subscription and earnings info
    const userIds = records.map((u) => u._id);
    const subscriptions = await DB.Models.Subscription.find({
      user: { $in: userIds },
      status: "active",
    }).lean();

    const subscriptionUserIds = new Set(
      subscriptions.map((s) => s.user.toString())
    );

    const data = records.map((u) => {
      let points = 0;

      // Earn register points if verified
      if (u.isAccountVerified) {
        points += Number(referralRegisteredPoints?.value || 0);
      }

      // Earn subscribed points if active subscription
      if (subscriptionUserIds.has(u._id.toString())) {
        points += Number(referralSubscribedPoints?.value || 0);
      }

      return {
        ...u,
        referralPoints: points,
        hasActiveSubscription: subscriptionUserIds.has(u._id.toString()),
      };
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data,
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
 * Fetch referral stats summary for authenticated user
 */
export const fetchReferralStats = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userReferralCode = req.user?.referralCode;

    // Ensure referral system is enabled
    const referralStatusSettings = await SystemSettingService.getSetting("referral_enabled");
    if (!referralStatusSettings?.value) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Sorry referral system is turned off."
      );
    }

    // Fetch referral points from system settings
    const referralRegisteredPoints = await SystemSettingService.getSetting("referral_register_price");
    const referralSubscribedPoints = await SystemSettingService.getSetting("referral_subscribed_agent_point");

    // Get all referred users
    const referredUsers = await DB.Models.User.find({
      referredBy: userReferralCode,
      isDeleted: false,
    }).lean();

    const referredUserIds = referredUsers.map((u) => u._id);

    // Get active subscriptions for referred users
    const activeSubscriptions = await DB.Models.Subscription.find({
      user: { $in: referredUserIds },
      status: "active",
    }).lean();

    const activeSubscriptionUserIds = new Set(
      activeSubscriptions.map((s) => s.user.toString())
    );

    // Counters
    let totalEarnings = 0;
    let totalEarningsThisMonth = 0;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalApprovedReferred = 0;
    let totalPendingReferred = 0;
    let totalSubscribedReferred = 0;

    for (const u of referredUsers) {
      let userPoints = 0;

      if (u.isAccountVerified) {
        userPoints += Number(referralRegisteredPoints?.value || 0);
        totalApprovedReferred++;
      } else {
        totalPendingReferred++;
      }

      if (activeSubscriptionUserIds.has(u._id.toString())) {
        userPoints += Number(referralSubscribedPoints?.value || 0);
        totalSubscribedReferred++;
      }

      totalEarnings += userPoints;

      // Check if referred in current month
      if (u?.createdAt && u?.createdAt >= startOfMonth) {
        totalEarningsThisMonth += userPoints;
      }
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: {
        totalReferred: referredUsers.length,
        totalEarnings,
        totalEarningsThisMonth,
        totalApprovedReffered: totalApprovedReferred,
        totalPendingReffered: totalPendingReferred,
        totalSubscribedReferred,
      },
    });
  } catch (err) {
    next(err);
  }
};
