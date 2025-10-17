import { Types } from "mongoose";
import { DB } from "../controllers";
import { IReferralLog } from "../models/referralLog";

class ReferralService {
  private ReferralLog = DB.Models.ReferralLog;

  /**
   * Log a new referral action
   */
  async createReferralLog(data: {
    referrerId: Types.ObjectId;
    referredUserId: Types.ObjectId;
    rewardType: IReferralLog["rewardType"];
    triggerAction: string;
    rewardStatus?: string;
    rewardAmount?: number;
    meta?: Record<string, any>;
    note?: string;
  }): Promise<IReferralLog> {
    return this.ReferralLog.create({
      referrerId: data.referrerId,
      referredUserId: data.referredUserId,
      rewardType: data.rewardType,
      triggerAction: data.triggerAction,
      rewardStatus: data.rewardStatus ?? 'pending',
      rewardAmount: data.rewardAmount ?? 0,
      meta: data.meta ?? {},
      note: data.note,
    });
  }
 
  /**
   * Get all users referred by a given user
   */
  async getReferralsByUser(referrerId: Types.ObjectId): Promise<IReferralLog[]> {
    return this.ReferralLog.find({ referrerId }).sort({ createdAt: -1 }).lean();
  }

  /**
   * Get all referral logs for a specific referred user
   */
  async getReferralsForUser(referredUserId: Types.ObjectId): Promise<IReferralLog[]> {
    return this.ReferralLog.find({ referredUserId }).sort({ createdAt: -1 }).lean();
  }

  /**
   * Update reward status for a referral log
   */
  async updateRewardStatus(referralLogId: Types.ObjectId, status: IReferralLog["rewardStatus"]): Promise<IReferralLog | null> {
    return this.ReferralLog.findByIdAndUpdate(
      referralLogId,
      { rewardStatus: status },
      { new: true }
    );
  }

  /**
   * Calculate total granted rewards for a user
   */
  async getTotalRewards(referrerId: Types.ObjectId): Promise<number> {
    const logs = await this.ReferralLog.find({
      referrerId,
      rewardStatus: "granted",
    }).lean();
    return logs.reduce((sum, log) => sum + (log.rewardAmount ?? 0), 0);
  }

  /**
   * Find a referral log by action (e.g., avoid duplicate rewards)
   */
  async findReferralByTriggerAction(
    referrerId: Types.ObjectId,
    referredUserId: Types.ObjectId,
    triggerAction: string
  ): Promise<IReferralLog | null> {
    return this.ReferralLog.findOne({
      referrerId,
      referredUserId,
      triggerAction,
    }).lean();
  }
}

export const referralService = new ReferralService();
