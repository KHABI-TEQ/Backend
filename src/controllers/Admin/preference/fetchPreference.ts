import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";

// either by "developer" or "buyer" or "tenant" or "shortlet"
export const getPreferencesByMode = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      preferenceMode, // Required
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

    if (!preferenceMode) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "preferenceMode is required",
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
      if (minBudget)
        filter.$and.push({ budgetMin: { $gte: Number(minBudget) } });
      if (maxBudget)
        filter.$and.push({ budgetMax: { $lte: Number(maxBudget) } });
    }

    // Bedrooms/Bathrooms based on preferenceMode
    if (minBedrooms) {
      if (preferenceMode === "buy" || preferenceMode === "tenant") {
        filter["propertyDetails.minBedrooms"] = { $gte: Number(minBedrooms) };
      } else if (preferenceMode === "shortlet") {
        filter["bookingDetails.minBedrooms"] = { $gte: Number(minBedrooms) };
      } else if (preferenceMode === "developer") {
        filter["developmentDetails.minBedrooms"] = {
          $gte: Number(minBedrooms),
        };
      }
    }

    if (minBathrooms) {
      if (preferenceMode === "buy" || preferenceMode === "tenant") {
        filter["propertyDetails.minBathrooms"] = { $gte: Number(minBathrooms) };
      } else if (preferenceMode === "shortlet") {
        filter["bookingDetails.minBathrooms"] = { $gte: Number(minBathrooms) };
      } else if (preferenceMode === "developer") {
        filter["developmentDetails.minBathrooms"] = {
          $gte: Number(minBathrooms),
        };
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

    const sortObj: any = {};
    sortObj[sortBy.toString()] = sortOrder === "asc" ? 1 : -1;

    const preferences = await DB.Models.Preference.find(filter)
      .populate("buyer")
      .populate("assignedAgent")
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit));

    const total = await DB.Models.Preference.countDocuments(filter);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Preferences fetched successfully",
      data: preferences,
      meta: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
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

    if (!preferenceId) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Preference ID is required",
      });
    }

    const preference = await DB.Models.Preference.findById(preferenceId)
      .populate("buyer")
      .populate("assignedAgent");

    if (!preference) {
      return next(
        new RouteError(HttpStatusCodes.NOT_FOUND, "Preference not found"),
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
