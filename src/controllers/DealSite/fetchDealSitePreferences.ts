import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import { DB } from "..";
import { RouteError } from "../../common/classes";
import HttpStatusCodes from "../../common/HttpStatusCodes";

// ✅ Fetch preferences for the DealSite of the logged-in agent
export const fetchMyDealSitePreference = async (
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

    // 1️⃣ Get DealSite owned by this agent
    const dealSite = await DB.Models.DealSite.findOne({ createdBy: userId })
    .sort({
      createdAt: -1,
    })
    .select("-paymentDetails -__v")
    .lean();

    if (!dealSite) {
      return next(
        new RouteError(
          HttpStatusCodes.NOT_FOUND,
          "Public access page not found",
        ),
      );
    }

    const dealSiteId = dealSite._id.toString();

    // --- Query parameters ---
    const {
      status,
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

    const filter: any = { "receiverMode.dealSiteID": dealSiteId };

    // --- Filters ---
    if (status) filter.status = status;

    if (state) filter["location.state"] = state;
    if (lga) filter["location.localGovernmentAreas"] = lga;
    if (area) filter["location.lgasWithAreas.areas"] = area;

    if (minBudget || maxBudget) {
      filter.$and = [];
      if (minBudget) filter.$and.push({ "budget.minPrice": { $gte: Number(minBudget) } });
      if (maxBudget) filter.$and.push({ "budget.maxPrice": { $lte: Number(maxBudget) } });
    }

    if (minBedrooms) {
      filter.$or = [
        { "propertyDetails.minBedrooms": { $gte: Number(minBedrooms) } },
        { "bookingDetails.minBedrooms": { $gte: Number(minBedrooms) } },
        { "developmentDetails.minBedrooms": { $gte: Number(minBedrooms) } },
      ];
    }

    if (minBathrooms) {
      filter.$or = [
        { "propertyDetails.minBathrooms": { $gte: Number(minBathrooms) } },
        { "bookingDetails.minBathrooms": { $gte: Number(minBathrooms) } },
        { "developmentDetails.minBathrooms": { $gte: Number(minBathrooms) } },
      ];
    }

    if (propertyType) {
      filter.$or = [
        { "propertyDetails.propertyType": propertyType },
        { "bookingDetails.propertyType": propertyType },
        { "developmentDetails.propertyType": propertyType },
      ];
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

    // --- Fetch preferences for this DealSite only ---
    const preferences = await DB.Models.Preference.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit));

    const total = await DB.Models.Preference.countDocuments(filter);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Preferences fetched successfully",
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
