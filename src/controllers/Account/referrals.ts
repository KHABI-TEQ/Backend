import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { DB } from "..";
import { RouteError } from "../../common/classes";
import { SystemSettingService } from "../../services/systemSetting.service";
import mongoose from "mongoose";

/**
 * Fetch referral records, grouped by referredUserId
 */
export const fetchReferralRecords = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    const { page = 1, limit = 10, userType, accountStatus } = req.query;

    // ensure referral is enabled
    const referralStatusSettings = await SystemSettingService.getSetting("referral_enabled");
    if (!referralStatusSettings?.value) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Sorry referral system is turn off.");
    }

    const referralRegisteredPoints = await SystemSettingService.getSetting("referral_register_price");
    const referralSubscribedPoints = await SystemSettingService.getSetting("referral_subscribed_agent_point");

    // Build base match condition
    const match: any = { referrerId: new mongoose.Types.ObjectId(userId) };

    // lookup into User (for filtering by userType/accountStatus)
    if (userType || accountStatus) {
      const referredUsers = await DB.Models.User.find({
        ...(userType ? { userType } : {}),
        ...(accountStatus ? { accountStatus } : {}),
      }).select("_id");

      const referredIds = referredUsers.map((u) => u._id);
      match.referredUserId = { $in: referredIds };
    }

    // aggregate pipeline
    const pipeline: any[] = [
      { $match: match },
      {
        $group: {
          _id: "$referredUserId",
          referredUserId: { $first: "$referredUserId" },
          logs: { $push: "$$ROOT" },
          totalRewards: { $sum: "$rewardAmount" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "referredUserId",
          foreignField: "_id",
          as: "referredUser",
        },
      },
      { $unwind: "$referredUser" },
      {
        $project: {
          referredUser: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            fullName: 1,
            email: 1,
            userType: 1,
            accountStatus: 1,
            isAccountVerified: 1,
          },
          logs: 1,
          totalRewards: 1,
        },
      },
      { $sort: { "referredUser.createdAt": -1 } },
    ];

    // pagination
    const skip = (Number(page) - 1) * Number(limit);
    const totalGroups = await DB.Models.ReferralLog.aggregate([...pipeline, { $count: "count" }]);
    const total = totalGroups[0]?.count || 0;

    const data = await DB.Models.ReferralLog.aggregate([
      ...pipeline,
      { $skip: skip },
      { $limit: Number(limit) },
    ]);

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
 * Fetch referral statistics for current user
 */
export const fetchReferralStats = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
  
    // ensure referral is enabled
    const referralStatusSettings = await SystemSettingService.getSetting("referral_enabled");
    if (!referralStatusSettings?.value) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Sorry referral system is turn off.");
    }

    const referralRegisteredPoints = Number(
      (await SystemSettingService.getSetting("referral_register_price"))?.value || 0
    );
    const referralSubscribedPoints = Number(
      (await SystemSettingService.getSetting("referral_subscribed_agent_point"))?.value || 0
    );

    // fetch all referral logs
    const logs = await DB.Models.ReferralLog.find({ referrerId: userId });

    const totalReferred = new Set(logs.map((l) => String(l.referredUserId))).size;
    const totalEarnings = logs.reduce((sum, l) => sum + (l.rewardAmount || 0), 0);

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const totalEarningsThisMonth = logs
      .filter((l) => l.createdAt >= startOfMonth)
      .reduce((sum, l) => sum + (l.rewardAmount || 0), 0);

    const totalApprovedReferred = logs.filter((l) => l.rewardStatus === "granted").length;
    const totalPendingReferred = logs.filter((l) => l.rewardStatus === "pending").length;
    const totalSubscribedReferred = logs.filter((l) => l.rewardType === "subscription").length;

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: {
        totalReferred,
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
