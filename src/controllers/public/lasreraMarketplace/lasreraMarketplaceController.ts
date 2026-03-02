import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";

/**
 * GET /lasrera-marketplace/properties
 * Public list of LASRERA Market Place properties. No landlord/developer contact is returned.
 * Each property has an action "Request To Market" (only Agents can use it; requires auth).
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
          "propertyType propertyCategory price location additionalFeatures pictures briefType description createdAt _id"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      DB.Models.Property.countDocuments(query),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "LASRERA Market Place properties. Contact is not shown; use 'Request To Market' (Agents only).",
      data: properties,
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
