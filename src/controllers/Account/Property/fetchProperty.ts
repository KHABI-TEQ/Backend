import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";

export const fetchSingleProperty = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { propertyId } = req.params;

    const property =
      await DB.Models.Property.findById(propertyId).populate("owner");

    if (!property) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Property not found");
    }

    const ownerId =
      (property.owner as any)?._id?.toString() || property.owner.toString();

    if (ownerId !== req.user._id.toString()) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "You do not have permission to access this property",
      );
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: property,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /account/properties/fetchAll
 * Returns the authenticated user's properties. Filter by owner (same as request-to-market:
 * property.owner is the user). When no status or isApproved filter is sent, returns all
 * of the user's properties (no default "approved only").
 */
export const fetchAllProperties = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      propertyType,
      propertyCategory,
      state,
      localGovernment,
      area,
      priceMin,
      priceMax,
      isApproved,
    } = req.query;

    // Filter by owner (same concept as request-to-market: Publisher = property owner)
    const filter: any = {
      owner: req.user._id,
      isDeleted: false,
    };

    // Only apply status/isApproved when explicitly sent; no default "approved only"
    if (status != null && status !== "") filter.status = status;
    if (isApproved !== undefined && isApproved !== "") filter.isApproved = isApproved === "true";

    if (propertyType) filter.propertyType = propertyType;
    if (propertyCategory) filter.propertyCategory = propertyCategory;
    if (state) filter["location.state"] = state;
    if (localGovernment) filter["location.localGovernment"] = localGovernment;
    if (area) filter["location.area"] = area;

    if (priceMin || priceMax) {
      filter.price = {};
      if (priceMin) filter.price.$gte = Number(priceMin);
      if (priceMax) filter.price.$lte = Number(priceMax);
    }

    const properties = await DB.Models.Property.find(filter)
      .populate("owner")
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await DB.Models.Property.countDocuments(filter);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: properties,
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
