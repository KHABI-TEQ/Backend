import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { formatPreferenceForFrontend, PreferencePayload } from "../../../utils/preferenceFormatter";

/**
 * Authenticated agents: list general (main-site) preferences for the marketplace dashboard.
 * Includes buyer + contactInfo for outreach; same shape as public formatter plus receiverMode.
 */
export const fetchGeneralMarketplacePreferences = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
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

    const andParts: Record<string, unknown>[] = [
      { $nor: [{ "receiverMode.type": "dealSite" }] },
      { status: { $in: ["approved", "matched"] } },
    ];

    if (preferenceMode) andParts.push({ preferenceMode });
    if (preferenceType) andParts.push({ preferenceType });

    if (keyword) {
      const regex = new RegExp(String(keyword), "i");
      andParts.push({
        $or: [
          { "location.state": regex },
          { "location.localGovernmentAreas": regex },
          { "location.lgasWithAreas.lgaName": regex },
          { "location.lgasWithAreas.areas": regex },
          { "location.customLocation": regex },
          { "contactInfo.fullName": regex },
          { "contactInfo.email": regex },
          { "contactInfo.phoneNumber": regex },
          { "contactInfo.contactPerson": regex },
          { "contactInfo.companyName": regex },
        ],
      });
    }

    if (documentType) {
      andParts.push({
        $or: [
          { "propertyDetails.documentTypes": documentType },
          { "developmentDetails.documentTypes": documentType },
          { "bookingDetails.documentTypes": documentType },
        ],
      });
    }

    if (propertyCondition) {
      andParts.push({
        $or: [
          { "propertyDetails.propertyCondition": propertyCondition },
          { "developmentDetails.propertyCondition": propertyCondition },
          { "bookingDetails.propertyCondition": propertyCondition },
        ],
      });
    }

    const filters = { $and: andParts };

    const skip = (Number(page) - 1) * Number(limit);

    const preferences = await DB.Models.Preference.find(filters)
      .populate("buyer")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await DB.Models.Preference.countDocuments(filters);

    const data = preferences.map((pref) => ({
      ...formatPreferenceForFrontend(pref as unknown as PreferencePayload),
      receiverMode: pref.receiverMode,
    }));

    res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "General marketplace preferences fetched successfully",
      data,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)) || 1,
        limit: Number(limit),
      },
    });
  } catch (err) {
    next(err);
  }
};
