import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { Types } from "mongoose";

/**
 * GET /lasrera-marketplace/properties
 * Public list of LASRERA Market Place properties. No landlord/developer contact is returned.
 * Each property includes requestToMarketCount and currentUserHasRequested (when an Agent is logged in).
 */
export const listLasreraMarketplaceProperties = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page = "1", limit = "20", briefType, state, minPrice, maxPrice } = req.query as Record<string, string>;

    const query: any = {
      listingScope: "lasrera_marketplace",
      isApproved: true,
      isDeleted: false,
      isAvailable: true,
      status: "approved",
    };

    if (briefType) query.briefType = briefType;
    if (state) query["location.state"] = new RegExp(state.trim(), "i");
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [properties, total] = await Promise.all([
      DB.Models.Property.find(query)
        .select(
          "propertyType propertyCategory price location status additionalFeatures pictures briefType description agentCommissionAmount createdAt _id"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      DB.Models.Property.countDocuments(query),
    ]);

    const propertyIds = (properties as any[]).map((p) => p._id);

    // Count of agents who have requested to market each property (any status: pending, accepted, rejected)
    const countAgg = await DB.Models.RequestToMarket.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { propertyId: { $in: propertyIds } } },
      { $group: { _id: "$propertyId", count: { $sum: 1 } } },
    ]);
    const countByPropertyId = new Map<string, number>();
    countAgg.forEach((row) => countByPropertyId.set(String(row._id), row.count));

    // When logged-in user is an Agent, which of these properties have they requested (any status)?
    let currentUserRequestedPropertyIds = new Set<string>();
    const currentUserId = req.user?._id;
    const userType = (req.user as any)?.userType;
    if (currentUserId && userType === "Agent") {
      const myRequests = await DB.Models.RequestToMarket.find({
        propertyId: { $in: propertyIds },
        requestedByAgentId: currentUserId,
      })
        .select("propertyId")
        .lean();
      myRequests.forEach((r) => currentUserRequestedPropertyIds.add(String((r as any).propertyId)));
    }

    const data = (properties as any[]).map((p) => ({
      ...p,
      requestToMarketCount: countByPropertyId.get(String(p._id)) ?? 0,
      currentUserHasRequested: currentUserRequestedPropertyIds.has(String(p._id)),
    }));

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "KHABITEQ Market Place properties. Contact is not shown; use 'Request To Market' (Agents only).",
      data,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
};
