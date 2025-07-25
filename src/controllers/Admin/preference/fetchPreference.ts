import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import mongoose from "mongoose";
import { formatPreferenceForFrontend, PreferencePayload } from "../../../utils/preferenceFormatter";

// either by "developer" or "buyer" or "tenant" or "shortlet"
export const getPreferencesByMode = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      status,
      assignedAgent,
      buyerId,
      minBudget,
      maxBudget,
      state,
      lga,
      area,
      propertyType,
      minBedrooms,
      minBathrooms,
      startDate,
      endDate,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 20,
    } = req.query;

    const preferenceModeParam = req.params.preferenceMode?.toString().toLowerCase();

    const modeMap: Record<string, string> = {
      buyers: "buy",
      tenants: "tenant",
      shortlets: "shortlet",
      developers: "developer",
    };

    const preferenceMode = modeMap[preferenceModeParam || ""];

    if (!preferenceMode) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message:
          "Invalid preference mode. Use one of: buyers, tenants, shortlets, developers.",
      });
    }

    const filter: any = { preferenceMode };

    if (status) filter.status = status;
    if (assignedAgent) filter.assignedAgent = assignedAgent;
    if (buyerId) filter.buyer = buyerId;

    if (state) filter["location.state"] = state;
    if (lga) filter["location.localGovernmentAreas"] = lga;
    if (area) filter["location.lgasWithAreas.areas"] = area;

    if (minBudget || maxBudget) {
      filter.$and = [];
      if (minBudget) filter.$and.push({ budgetMin: { $gte: Number(minBudget) } });
      if (maxBudget) filter.$and.push({ budgetMax: { $lte: Number(maxBudget) } });
    }

    // Bedrooms & Bathrooms
    if (minBedrooms) {
      if (preferenceMode === "buy" || preferenceMode === "tenant") {
        filter["propertyDetails.minBedrooms"] = { $gte: Number(minBedrooms) };
      } else if (preferenceMode === "shortlet") {
        filter["bookingDetails.minBedrooms"] = { $gte: Number(minBedrooms) };
      } else if (preferenceMode === "developer") {
        filter["developmentDetails.minBedrooms"] = { $gte: Number(minBedrooms) };
      }
    }

    if (minBathrooms) {
      if (preferenceMode === "buy" || preferenceMode === "tenant") {
        filter["propertyDetails.minBathrooms"] = { $gte: Number(minBathrooms) };
      } else if (preferenceMode === "shortlet") {
        filter["bookingDetails.minBathrooms"] = { $gte: Number(minBathrooms) };
      } else if (preferenceMode === "developer") {
        filter["developmentDetails.minBathrooms"] = { $gte: Number(minBathrooms) };
      }
    }

    if (propertyType) {
      if (preferenceMode === "buy" || preferenceMode === "tenant") {
        filter["propertyDetails.propertyType"] = propertyType;
      } else if (preferenceMode === "shortlet") {
        filter["bookingDetails.propertyType"] = propertyType;
      } else if (preferenceMode === "developer") {
        filter["developmentDetails.propertyType"] = propertyType;
      }
    }

    if (startDate || endDate) {
      filter.createdAt = {
        ...(startDate && { $gte: new Date(startDate.toString()) }),
        ...(endDate && { $lte: new Date(endDate.toString()) }),
      };
    }

    if (search) {
      const regex = new RegExp(search.toString(), "i");
      filter.$or = [
        { "location.state": regex },
        { "location.localGovernmentAreas": regex },
        { "location.lgasWithAreas.lgaName": regex },
        { "contactInfo.fullName": regex },
        { "contactInfo.contactPerson": regex },
        { "contactInfo.email": regex },
        { "contactInfo.phoneNumber": regex },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sortObj: any = { [sortBy.toString()]: sortOrder === "asc" ? 1 : -1 };

    const preferences = await DB.Models.Preference.find(filter)
      .populate("buyer")
      .populate("assignedAgent")
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit));

    const total = await DB.Models.Preference.countDocuments(filter);

    const formattedPreferences = preferences.map(pref => {
      const plainObjectFromMongoose = pref.toObject({ getters: true, virtuals: true });
      const formattedInputForFormatter = plainObjectFromMongoose as unknown as PreferencePayload;
      return formatPreferenceForFrontend(formattedInputForFormatter);
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Preferences fetched successfully",
      data: formattedPreferences, // Send the formatted data
      pagination: {
        total,
        limit,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};


export const getSinglePreference = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { preferenceId } = req.params;

    if (!preferenceId || !mongoose.Types.ObjectId.isValid(preferenceId)) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Valid Preference ID is required",
      });
    }

    // Pagination query params
    const activePage = parseInt(req.query.activePage as string) || 1;
    const activeLimit = parseInt(req.query.activeLimit as string) || 10;

    const closedPage = parseInt(req.query.closedPage as string) || 1;
    const closedLimit = parseInt(req.query.closedLimit as string) || 10;

    // Fetch the current preference with populated fields
    const currentPreference = await DB.Models.Preference.findById(preferenceId)
      .populate("buyer")
      .populate("assignedAgent");

    if (!currentPreference) {
      return next(
        new RouteError(HttpStatusCodes.NOT_FOUND, "Preference not found"),
      );
    }

    const buyerId = currentPreference.buyer?._id;

    // Fetch all other preferences of the buyer
    const otherPreferences = await DB.Models.Preference.find({
      _id: { $ne: new mongoose.Types.ObjectId(preferenceId) },
      buyer: buyerId,
    });

    // Filter into active and closed
    const allActive = otherPreferences.filter((p) =>
      ["pending", "approved", "matched"].includes(p.status),
    );
    const allClosed = otherPreferences.filter((p) => p.status === "closed");

    // Apply pagination manually
    const paginatedActive = allActive.slice(
      (activePage - 1) * activeLimit,
      activePage * activeLimit,
    );
    const paginatedClosed = allClosed.slice(
      (closedPage - 1) * closedLimit,
      closedPage * closedLimit,
    );

    // 1. Format currentPreference
    const formattedCurrentPreference = formatPreferenceForFrontend(
      currentPreference.toObject({ getters: true, virtuals: true }) as unknown as PreferencePayload
    );

    // 2. Format paginatedActive items
    const formattedPaginatedActive = paginatedActive.map(pref =>
      formatPreferenceForFrontend(pref.toObject({ getters: true, virtuals: true }) as unknown as PreferencePayload)
    );

    // 3. Format paginatedClosed items
    const formattedPaginatedClosed = paginatedClosed.map(pref =>
      formatPreferenceForFrontend(pref.toObject({ getters: true, virtuals: true }) as unknown as PreferencePayload)
    );

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Preference fetched successfully",
      data: {
        buyerProfile: currentPreference.buyer,
        currentPreference: formattedCurrentPreference, // Use the formatted version
        activePreferences: {
          total: allActive.length,
          page: activePage,
          limit: activeLimit,
          items: formattedPaginatedActive, // Use the formatted version
        },
        closedPreferences: {
          total: allClosed.length,
          page: closedPage,
          limit: closedLimit,
          items: formattedPaginatedClosed, // Use the formatted version
        },
      },
    });
  } catch (err) {
    next(err);
  }
};


export const getPreferenceModeStats = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const modeParam = req.params.preferenceMode?.toString().toLowerCase();

    const modeMap: Record<string, string> = {
      buyers: "buy",
      tenants: "tenant",
      shortlets: "shortlet",
      developers: "developer",
    };

    const preferenceMode = modeMap[modeParam || ""];

    if (!preferenceMode) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message:
          "Invalid preference mode. Use one of: buyers, tenants, shortlets, developers.",
      });
    }

    const all = await DB.Models.Preference.find({ preferenceMode });

    const total = all.length;

    const active = all.filter((p) =>
      ["pending", "approved", "matched"].includes(p.status),
    ).length;

    const closed = all.filter((p) => p.status === "closed").length;

    const approved = all.filter((p) => p.status === "approved").length;

    // Calculate avgBudget: average of midpoints of budgetMin and budgetMax
    const budgetPoints = all
      .filter((p) => typeof p.budget.minPrice === "number" && typeof p.budget.maxPrice === "number")
      .map((p) => (p.budget.minPrice + p.budget.maxPrice) / 2);

    const avgBudget =
      budgetPoints.length > 0
        ? budgetPoints.reduce((sum, val) => sum + val, 0) / budgetPoints.length
        : 0;

    const approvedRate = total > 0 ? (approved / total) * 100 : 0;

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: `Stats for ${preferenceMode}`,
      data: {
        preferenceMode,
        total,
        active,
        closed,
        approved,
        avgBudget: Math.round(avgBudget * 100) / 100, // round to 2 decimal places
        approvedRate: Math.round(approvedRate * 100) / 100, // round to %
      },
    });
  } catch (err) {
    next(err);
  }
};