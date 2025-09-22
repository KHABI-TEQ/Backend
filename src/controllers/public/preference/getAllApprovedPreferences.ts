import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { formatPreferenceForFrontend, PreferencePayload } from "../../../utils/preferenceFormatter";

export const getAllApprovedPreferences = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      page = 1,
      limit = 20,
      keyword,
      preferenceMode,
      preferenceType,
      documentType,
      propertyCondition,
    } = req.query;

    const filters: any = {
      status: { $in: ["approved", "closed"] }, // fetch both
    };

    if (preferenceMode) filters.preferenceMode = preferenceMode;
    if (preferenceType) filters.preferenceType = preferenceType;

    if (keyword) {
      const regex = new RegExp(keyword as string, "i");
      filters.$or = [
        { "location.state": regex },
        { "location.localGovernmentAreas": regex },
        { "location.lgasWithAreas.lgaName": regex },
        { "location.lgasWithAreas.areas": regex },
        { "location.customLocation": regex },
      ];
    }

    if (documentType) {
      filters.$or = [
        { "propertyDetails.documentTypes": documentType },
        { "developmentDetails.documentTypes": documentType },
        { "bookingDetails.documentTypes": documentType },
      ];
    }

    if (propertyCondition) {
      filters.$or = [
        { "propertyDetails.propertyCondition": propertyCondition },
        { "developmentDetails.propertyCondition": propertyCondition },
        { "bookingDetails.propertyCondition": propertyCondition },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    // custom sort: closed first, then approved, both by recent createdAt
    const preferences = await DB.Models.Preference.find(filters)
      .populate("buyer")
      .sort({createdAt: -1})
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // manual ordering (MongoDB doesn’t directly support custom enum sort order)
    const orderedPreferences = preferences.sort((a, b) => {
      if (a.status === b.status) {
        return b.createdAt.getTime() - a.createdAt.getTime(); // convert Date → number
      }
      return a.status === "closed" ? -1 : 1;
    });

    const total = await DB.Models.Preference.countDocuments(filters);

    const formattedPreferences = orderedPreferences.map((pref) =>
      formatPreferenceForFrontend(pref as unknown as PreferencePayload)
    );

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Approved and closed preferences fetched successfully",
      data: formattedPreferences,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
        limit: Number(limit),
      },
    });
  } catch (err) {
    next(err);
  }
};
