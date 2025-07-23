import { Request, Response, NextFunction } from "express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { AppRequest } from "../../../types/express";

export const findMatchedProperties = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { preferenceId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!preferenceId) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Preference ID is required",
      );
    }

    const preference = await DB.Models.Preference.findById(preferenceId).lean();
    if (!preference) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Preference not found");
    }

    const typeMapping: any = {
      buy: "Outright Sales",
      rent: "Rent",
      "joint-venture": "Joint Venture",
      shortlet: "Shortlet",
    };

    const briefType = typeMapping[preference.preferenceType];
    if (!briefType) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Invalid preference type",
      );
    }

    const matchQuery: any = {
      status: "approved",
      isAvailable: true,
      propertyCategory: briefType,
    };

    // Location Matching
    if (preference.location?.state) {
      matchQuery["location.state"] = preference.location.state;
    }
    if (preference.location?.localGovernmentAreas?.length) {
      matchQuery["location.localGovernment"] = {
        $in: preference.location.localGovernmentAreas,
      };
    }
    if (preference.location?.lgasWithAreas?.length) {
      const areas = preference.location.lgasWithAreas.flatMap(
        (lga: any) => lga.areas,
      );
      if (areas.length) {
        matchQuery["location.area"] = { $in: areas };
      }
    }

    // Budget Matching
    if (
      preference.budgetMin !== undefined &&
      preference.budgetMax !== undefined
    ) {
      matchQuery["price"] = {
        $gte: preference.budgetMin,
        $lte: preference.budgetMax,
      };
    }

    // Bedroom/Bathroom Matching
    const additionalFeaturesQuery: any = {};
    if (preference.preferenceType === "shortlet" && preference.bookingDetails) {
      if (preference.bookingDetails.minBedrooms) {
        additionalFeaturesQuery["additionalFeatures.noOfBedroom"] = {
          $gte: parseInt(preference.bookingDetails.minBedrooms),
        };
      }
      if (preference.bookingDetails.minBathrooms) {
        additionalFeaturesQuery["additionalFeatures.noOfBathroom"] = {
          $gte: preference.bookingDetails.minBathrooms,
        };
      }
    } else if (
      ["buy", "rent"].includes(preference.preferenceType) &&
      preference.propertyDetails
    ) {
      if (preference.propertyDetails.minBedrooms) {
        additionalFeaturesQuery["additionalFeatures.noOfBedroom"] = {
          $gte: parseInt(preference.propertyDetails.minBedrooms),
        };
      }
      if (preference.propertyDetails.minBathrooms) {
        additionalFeaturesQuery["additionalFeatures.noOfBathroom"] = {
          $gte: preference.propertyDetails.minBathrooms,
        };
      }
    }

    const finalQuery = { ...matchQuery, ...additionalFeaturesQuery };

    const total = await DB.Models.Property.countDocuments(finalQuery);

    const properties = await DB.Models.Property.find(finalQuery)
      .sort({ createdAt: -1 }) // You can change sort based on score logic if needed
      .skip((+page - 1) * +limit)
      .limit(+limit)
      .lean();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Matched properties fetched successfully",
      data: properties,
      meta: {
        total,
        totalPages: Math.ceil(total / +limit),
        currentPage: +page,
        perPage: +limit,
      },
    });
  } catch (err) {
    next(err);
  }
};
