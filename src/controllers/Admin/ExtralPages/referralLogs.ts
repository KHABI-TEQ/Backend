import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { DB } from "../..";
import { RouteError } from "../../../common/classes";

/**
 * Fetch all referrals (paginated + filters)
 */
export const fetchAllReferrals = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page = 1, limit = 20, rewardType, rewardStatus } = req.query;

    const filter: Record<string, any> = {};
    if (rewardType) filter.rewardType = rewardType;
    if (rewardStatus) filter.rewardStatus = rewardStatus;

    const referrals = await DB.Models.ReferralLog.find(filter)
      .populate("referrerId referredUserId")
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .sort({ createdAt: -1 })
      .lean();

    const total = await DB.Models.ReferralLog.countDocuments(filter);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: referrals,
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
 * Get single referral details
 */
export const getReferralDetails = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { referralId } = req.params;

    const referral = await DB.Models.ReferralLog.findById(referralId)
      .populate("referrerId referredUserId")
      .lean();

    if (!referral) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Referral not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: referral,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Referral statistics (summary)
 */
export const getReferralStats = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const stats = await DB.Models.ReferralLog.aggregate([
      {
        $facet: {
          counts: [
            {
              $group: {
                _id: "$rewardStatus",
                count: { $sum: 1 },
                totalReward: { $sum: "$rewardAmount" },
              },
            },
          ],
          totals: [
            {
              $group: {
                _id: null,
                totalReferrals: { $sum: 1 },
                totalAmount: { $sum: "$rewardAmount" },
              },
            },
          ],
          mostReferredUser: [
            {
              $group: {
                _id: "$referredUserId",
                referrals: { $sum: 1 },
              },
            },
            { $sort: { referrals: -1 } },
            { $limit: 1 },
          ],
        },
      },
    ]);

    const counts = stats[0].counts || [];
    const totals = stats[0].totals[0] || { totalReferrals: 0, totalAmount: 0 };
    const mostReferredUser = stats[0].mostReferredUser[0] || null;

    const summary = {
      totalReferrals: totals.totalReferrals,
      totalGranted:
        counts.find((c: any) => c._id === "granted")?.count || 0,
      totalPending:
        counts.find((c: any) => c._id === "pending")?.count || 0,
      totalFailed:
        counts.find((c: any) => c._id === "failed")?.count || 0,
      totalAmount: totals.totalAmount,
      mostReferredUser,
    };

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: summary,
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Update referral (rewardStatus, rewardAmount, note)
 */
export const updateReferral = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { referralId } = req.params;
    const { rewardStatus, rewardAmount, note } = req.body;

    const referral = await DB.Models.ReferralLog.findById(referralId);
    if (!referral) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Referral not found");
    }

    if (rewardStatus) referral.rewardStatus = rewardStatus;
    if (rewardAmount !== undefined) referral.rewardAmount = rewardAmount;
    if (note !== undefined) referral.note = note;

    await referral.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Referral updated successfully",
      data: referral,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete referral (hard delete)
 */
export const deleteReferral = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { referralId } = req.params;

    const referral = await DB.Models.ReferralLog.findById(referralId);
    if (!referral) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Referral not found");
    }

    await DB.Models.ReferralLog.deleteOne({ _id: referralId });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Referral deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};
