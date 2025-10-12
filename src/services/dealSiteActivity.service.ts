import { Request } from "express";
import { DB } from "../controllers";
import { Types } from "mongoose";
import { ActivityActorModel, DealSiteActivityCategory } from "../models";

/**
 * Service to handle DealSite Activity logs
 */
class DealSiteActivityService {
  /**
   * Logs a new activity for a DealSite
   */
  async logActivity(params: {
    dealSiteId: Types.ObjectId | string;
    actorId: Types.ObjectId | string;
    actorModel: ActivityActorModel;
    category: DealSiteActivityCategory;
    action: string;
    description?: string;
    metadata?: Record<string, any>;
    req?: Request;
  }): Promise<void> {
    try {
      const {
        dealSiteId,
        actorId,
        actorModel,
        category,
        action,
        description,
        metadata,
        req,
      } = params;

      await DB.Models.DealSiteActivity.create({
        dealSite: dealSiteId,
        actor: actorId,
        actorModel,
        category,
        action,
        description,
        ipAddress: req?.ip,
        userAgent: req?.get("user-agent"),
        metadata,
      });
    } catch (error) {
      console.error("⚠️ Failed to log DealSite activity:", error);
    }
  }

  /**
   * Fetch all activity logs for a given DealSite (by slug)
   */
  async getActivitiesBySlug(publicSlug: string) {
    const dealSite = await DB.Models.DealSite.findOne({ publicSlug }).lean();
    if (!dealSite) throw new Error("DealSite not found");

    return DB.Models.DealSiteActivity.find({ dealSite: dealSite._id })
      .populate("actor", "firstName lastName email userType")
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Fetch recent activity logs for analytics/dashboard
   */
  async getRecentActivities(limit = 10) {
    return DB.Models.DealSiteActivity.find()
      .populate("dealSite", "name publicSlug")
      .populate("actor", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }
}

export const dealSiteActivityService = new DealSiteActivityService();
