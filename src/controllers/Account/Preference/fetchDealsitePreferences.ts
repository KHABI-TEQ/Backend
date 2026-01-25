import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import { RouteError } from "../../../common/classes";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import mongoose from "mongoose";

/**
 * Fetch all preferences submitted to the agent's dealsite
 * Only returns preferences where receiverMode.type === "dealSite" and dealSiteID matches the agent's dealsite
 */
export const fetchDealsitePreferences = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return next(
        new RouteError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized access"),
      );
    }

    // Get DealSite owned by this agent
    const dealSite = await DB.Models.DealSite.findOne({ createdBy: userId })
      .sort({ createdAt: -1 })
      .select("_id")
      .lean();

    if (!dealSite) {
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: "No dealsite found for this agent",
        data: [],
        pagination: {
          total: 0,
          limit: 20,
          page: 1,
          totalPages: 0,
        },
      });
    }

    const dealSiteId = dealSite._id;

    // Query parameters
    const {
      page = 1,
      limit = 20,
      status,
      minBudget,
      maxBudget,
      state,
      propertyType,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter
    const filter: any = {
      "receiverMode.type": "dealSite",
      "receiverMode.dealSiteID": dealSiteId,
    };

    if (status) filter.status = status;

    if (state) filter["location.state"] = state;

    if (propertyType) {
      filter.$or = [
        { preferenceMode: propertyType },
        { preferenceType: propertyType },
      ];
    }

    if (minBudget || maxBudget) {
      filter.budget = {};
      if (minBudget) filter.budget.$and = [{ minPrice: { $gte: Number(minBudget) } }];
      if (maxBudget) {
        if (filter.budget.$and) {
          filter.budget.$and.push({ maxPrice: { $lte: Number(maxBudget) } });
        } else {
          filter.budget.$and = [{ maxPrice: { $lte: Number(maxBudget) } }];
        }
      }
    }

    if (search) {
      const regex = new RegExp(search.toString(), "i");
      filter.$or = [
        { "location.state": regex },
        { "location.customLocation": regex },
        { "contactInfo.fullName": regex },
        { "contactInfo.contactPerson": regex },
        { "contactInfo.email": regex },
        { "contactInfo.phoneNumber": regex },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sortObj: any = { [sortBy.toString()]: sortOrder === "asc" ? 1 : -1 };

    // Fetch preferences
    const preferences = await DB.Models.Preference.find(filter)
      .populate("buyer", "firstName lastName email phoneNumber")
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await DB.Models.Preference.countDocuments(filter);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Dealsite preferences fetched successfully",
      data: preferences,
      pagination: {
        total,
        limit: Number(limit),
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Fetch single preference details by ID
 * Ensures the preference belongs to the agent's dealsite
 */
export const fetchDealsitePreferenceById = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?._id;
    const { preferenceId } = req.params;

    if (!userId) {
      return next(
        new RouteError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized access"),
      );
    }

    if (!mongoose.Types.ObjectId.isValid(preferenceId)) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Invalid preference ID",
      });
    }

    // Get DealSite owned by this agent
    const dealSite = await DB.Models.DealSite.findOne({ createdBy: userId })
      .select("_id")
      .lean();

    if (!dealSite) {
      return next(
        new RouteError(
          HttpStatusCodes.NOT_FOUND,
          "Dealsite not found for this agent",
        ),
      );
    }

    const dealSiteId = dealSite._id;

    // Fetch preference and verify it belongs to agent's dealsite
    const preference = await DB.Models.Preference.findOne({
      _id: preferenceId,
      "receiverMode.type": "dealSite",
      "receiverMode.dealSiteID": dealSiteId,
    })
      .populate("buyer")
      .lean();

    if (!preference) {
      return next(
        new RouteError(
          HttpStatusCodes.NOT_FOUND,
          "Preference not found or does not belong to your dealsite",
        ),
      );
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Preference fetched successfully",
      data: preference,
    });
  } catch (err) {
    next(err);
  }
};
