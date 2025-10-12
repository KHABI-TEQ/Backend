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
    });
    if (!promo) throw new Error("Promotion not found");
    return promo;
  }

  // ✅ Delete promotion
  async deletePromotion(id: string) {
    const promo = await DB.Models.Promotion.findByIdAndDelete(id);
    if (!promo) throw new Error("Promotion not found");
    return promo;
  }

  // ✅ Get single promotion
  async getPromotionById(id: string) {
    const promo = await DB.Models.Promotion.findById(id).populate("createdBy", "name email");
    if (!promo) throw new Error("Promotion not found");
    return promo;
  }

  // ✅ List promotions with advanced filters
  async listPromotions(filters: any = {}, pagination: any = {}) {
    const { status, type, isFeatured, search, startDate, endDate } = filters;
    const { page = 1, limit = 20 } = pagination;

    const query: any = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (isFeatured !== undefined) query.isFeatured = isFeatured;
    if (search)
      query.title = { $regex: search, $options: "i" };
    if (startDate || endDate)
      query.createdAt = {
        ...(startDate && { $gte: new Date(startDate) }),
        ...(endDate && { $lte: new Date(endDate) }),
      };

    const data = await DB.Models.Promotion.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("createdBy", "name email");

    const total = await DB.Models.Promotion.countDocuments(query);

    return { data, total, page, pages: Math.ceil(total / limit) };
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
      await DB.Models.PromotionActivity.create({
        promotionId,
        userId,
        ipAddress,
        userAgent,
        type,
      });

      // increment metric
      const updateField = type === "view" ? { $inc: { views: 1 } } : { $inc: { clicks: 1 } };
      await DB.Models.Promotion.findByIdAndUpdate(promotionId, updateField);
    } catch (err: any) {
      if (err.code === 11000) {
        // duplicate (ignore if same user/ip/type already logged)
        return;
      }
      throw err;
    }
  }

  // ✅ Analytics: get summary
  async getPromotionAnalytics(id: string) {
    const promotion = await DB.Models.Promotion.findById(id);
    if (!promotion) throw new Error("Promotion not found");

    const totalActivities = await DB.Models.PromotionActivity.countDocuments({
      promotionId: new Types.ObjectId(id),
    });

    const clickCount = await DB.Models.PromotionActivity.countDocuments({
      promotionId: new Types.ObjectId(id),
      type: "click",
    });

    const viewCount = await DB.Models.PromotionActivity.countDocuments({
      promotionId: new Types.ObjectId(id),
      type: "view",
    });

    return {
      promotionId: id,
      title: promotion.title,
      totalActivities,
      clicks: clickCount,
      views: viewCount,
      clickThroughRate:
        viewCount > 0 ? ((clickCount / viewCount) * 100).toFixed(2) + "%" : "0%",
    };
  }

  // promotion.service.ts (add below existing methods)
    async displayPromotions({
    type,
    limit = 3,
    userId,
    ipAddress,
    }: {
    type?: string;
    limit?: number;
    userId?: string;
    ipAddress?: string;
    }) {
    const query: any = { status: "active" };

    // Optionally filter expired ones
    query.$or = [
        { endDate: { $exists: false } },
        { endDate: { $gte: new Date() } },
    ];

    if (type) query.type = type;

    // Sort: prioritize featured, then random
    const data = await DB.Models.Promotion.aggregate([
        { $match: query },
        { $addFields: { sortWeight: { $cond: ["$isFeatured", 10, 1] } } },
        { $sample: { size: limit * 2 } }, // pick random set
        { $sort: { sortWeight: -1 } },
        { $limit: limit },
    ]);

    // Log views for all displayed promotions
    for (const promo of data) {
        await this.logActivity({
        promotionId: promo._id,
        userId,
        ipAddress,
        type: "view",
        });
    }

    return data;
    }

}
