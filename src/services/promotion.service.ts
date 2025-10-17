import { Types } from "mongoose";
import { DB } from "../controllers";

export class PromotionService {
  // ✅ Create a new promotion
  async createPromotion(data: any) {
    const promo = await DB.Models.Promotion.create(data);
    return promo;
  }

  // ✅ Update a promotion
  async updatePromotion(id: string, updates: any) {
    const promo = await DB.Models.Promotion.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });
    return promo; // Return null if not found (handled in controller)
  }

  // ✅ Delete promotion
  async deletePromotion(id: string) {
    const promo = await DB.Models.Promotion.findByIdAndDelete(id);
    return promo; // Return null if not found (handled in controller)
  }

  // ✅ Get single promotion
  async getPromotionById(id: string) {
    const promo = await DB.Models.Promotion.findById(id).populate(
      "createdBy",
      "firstName lastName email"
    );
    return promo; // Return null if not found (handled in controller)
  }

  // ✅ List promotions with advanced filters
  async listPromotions(filters: any = {}, pagination: any = {}) {
    const { status, type, isFeatured, search, startDate, endDate } = filters;
    const { page = 1, limit = 20 } = pagination;

    const query: any = {};
    
    if (status) query.status = status;
    if (type) query.type = type;
    if (isFeatured !== undefined) {
      query.isFeatured = isFeatured === "true" || isFeatured === true;
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }
    if (startDate || endDate) {
      query.createdAt = {
        ...(startDate && { $gte: new Date(startDate) }),
        ...(endDate && { $lte: new Date(endDate) }),
      };
    }

    const data = await DB.Models.Promotion.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("createdBy", "firstName lastName email");

    const total = await DB.Models.Promotion.countDocuments(query);

    return {
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  // ✅ Log promotion activity (view/click)
  async logActivity({
    promotionId,
    userId,
    ipAddress,
    userAgent,
    type,
  }: {
    promotionId: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    type: "view" | "click";
  }) {
    try {
      // FIXED: Check for recent activity to prevent spam (within last 1 hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const recentActivity = await DB.Models.PromotionActivity.findOne({
        promotionId: new Types.ObjectId(promotionId),
        type,
        createdAt: { $gte: oneHourAgo },
        ...(userId && { userId: new Types.ObjectId(userId) }),
        ...(!userId && ipAddress && { ipAddress, userId: { $exists: false } }),
      });

      if (recentActivity) {
        // Skip logging if already logged recently
        return;
      }

      // Log the activity
      await DB.Models.PromotionActivity.create({
        promotionId: new Types.ObjectId(promotionId),
        userId: userId ? new Types.ObjectId(userId) : undefined,
        ipAddress,
        userAgent,
        type,
      });

      // Increment metric on promotion
      const updateField =
        type === "view" ? { $inc: { views: 1 } } : { $inc: { clicks: 1 } };
      
      await DB.Models.Promotion.findByIdAndUpdate(promotionId, updateField);
    } catch (err: any) {
      console.error("Error logging promotion activity:", err);
      // Don't throw - activity logging shouldn't break the main flow
    }
  }

  // ✅ Analytics: get summary
  async getPromotionAnalytics(id: string) {
    const promotion = await DB.Models.Promotion.findById(id);
    if (!promotion) return null;

    const promotionObjectId = new Types.ObjectId(id);

    const [clickCount, viewCount, uniqueUsers, topSources] = await Promise.all([
      DB.Models.PromotionActivity.countDocuments({
        promotionId: promotionObjectId,
        type: "click",
      }),
      DB.Models.PromotionActivity.countDocuments({
        promotionId: promotionObjectId,
        type: "view",
      }),
      DB.Models.PromotionActivity.distinct("userId", {
        promotionId: promotionObjectId,
        userId: { $exists: true },
      }).then((users) => users.length),
      // Get top 5 IP addresses (for anonymous tracking)
      DB.Models.PromotionActivity.aggregate([
        { $match: { promotionId: promotionObjectId } },
        { $group: { _id: "$ipAddress", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const totalActivities = clickCount + viewCount;
    const ctr = viewCount > 0 ? ((clickCount / viewCount) * 100).toFixed(2) : "0.00";

    return {
      promotionId: id,
      title: promotion.title,
      type: promotion.type,
      status: promotion.status,
      totalActivities,
      clicks: clickCount,
      views: viewCount,
      clickThroughRate: `${ctr}%`,
      uniqueUsers,
      topSources: topSources.map((s) => ({
        ipAddress: s._id || "Unknown",
        activities: s.count,
      })),
      createdAt: promotion.createdAt,
      startDate: promotion.startDate,
      endDate: promotion.endDate,
    };
  }

  // ✅ Display promotions (for frontend)
  async displayPromotions({
    type,
    limit = 3,
    userId,
    ipAddress,
    excludeIds = [],
  }: {
    type?: string;
    limit?: number;
    userId?: string;
    ipAddress?: string;
    excludeIds?: string[];
  }) {
    const now = new Date();
    const query: any = { status: "active" };

    // Filter by date range
    query.$and = [
      {
        $or: [
          { startDate: { $exists: false } },
          { startDate: { $lte: now } },
        ],
      },
      {
        $or: [
          { endDate: { $exists: false } },
          { endDate: { $gte: now } },
        ],
      },
    ];

    if (type) query.type = type;
    
    // Exclude certain promotions (e.g., already shown)
    if (excludeIds.length > 0) {
      query._id = { $nin: excludeIds.map((id) => new Types.ObjectId(id)) };
    }

    // Get promotions with weighted randomization
    const data = await DB.Models.Promotion.aggregate([
      { $match: query },
      {
        $addFields: {
          sortWeight: {
            $add: [
              { $cond: ["$isFeatured", 100, 0] },
              { $multiply: [{ $rand: {} }, 10] },
            ],
          },
        },
      },
      { $sort: { sortWeight: -1 } },
      { $limit: limit },
      {
        $project: {
          sortWeight: 0,
        },
      },
    ]);

    // Log views for displayed promotions (async, don't await)
    Promise.all(
      data.map((promo) =>
        this.logActivity({
          promotionId: promo._id.toString(),
          userId,
          ipAddress,
          type: "view",
        })
      )
    ).catch((err) => console.error("Error logging bulk views:", err));

    return data;
  }

  // ✅ Get active promotions by type (for specific placements)
  async getActivePromotionsByType(type: string, limit = 5) {
    const now = new Date();
    
    const promotions = await DB.Models.Promotion.find({
      status: "active",
      type,
      $and: [
        {
          $or: [
            { startDate: { $exists: false } },
            { startDate: { $lte: now } },
          ],
        },
        {
          $or: [
            { endDate: { $exists: false } },
            { endDate: { $gte: now } },
          ],
        },
      ],
    })
      .sort({ isFeatured: -1, createdAt: -1 })
      .limit(limit)
      .select("-createdBy -__v");

    return promotions;
  }

  // ✅ Bulk update expired promotions (cron job helper)
  async expireOldPromotions() {
    const now = new Date();
    
    const result = await DB.Models.Promotion.updateMany(
      {
        status: "active",
        endDate: { $exists: true, $lt: now },
      },
      {
        $set: { status: "expired" },
      }
    );

    return result.modifiedCount;
  }
}