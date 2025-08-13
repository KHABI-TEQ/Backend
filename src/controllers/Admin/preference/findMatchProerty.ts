import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { formatPropertyDataForTable } from "../../../utils/propertyFormatters";

// Map briefType to preferenceType
const briefTypeToPreferenceType: Record<string, string> = {
  "Outright Sales": "buy",
  "Joint Venture": "joint-venture",
  "Rent": "rent",
  "Shortlet": "shortlet",
};

// Match scoring
const calculateMatchScore = (property: any, preference: any): number => {
  let score = 0;

  // Location match (local government)
  if (
    property.location?.localGovernment &&
    preference.location?.localGovernmentAreas?.includes(property.location.localGovernment)
  ) {
    score += 30;
  }

  // Budget match
  const price = Number(property.price?.toString().replace(/[^\d.]/g, "")) || 0;
  if (
    preference.budget?.minPrice != null &&
    preference.budget?.maxPrice != null &&
    price >= preference.budget.minPrice &&
    price <= preference.budget.maxPrice
  ) {
    score += 40;
  }

  // Preference type match
  const propertyPrefType = briefTypeToPreferenceType[property.briefType] || "";
  if (propertyPrefType === preference.preferenceType) {
    score += 30;
  }

  // Bedroom match
  const minBed = preference.propertyDetails?.minBedrooms;
  const bedCount = Number(property.additionalFeatures?.noOfBedroom) || 0;
  if (minBed && bedCount >= minBed) score += 5;

  // Bathroom match
  const minBath = preference.propertyDetails?.minBathrooms;
  const bathCount = Number(property.additionalFeatures?.noOfBathroom) || 0;
  if (minBath && bathCount >= minBath) score += 5;

  return Math.min(score, 100);
};

// Controller
export const findMatchedProperties = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { preferenceId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!preferenceId) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Preference ID is required",
      });
    }

    const preference = await DB.Models.Preference.findById(preferenceId).lean();
    if (!preference) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Preference not found");
    }

    const finalQuery: any = {
      "location.state": preference.location?.state,
      isDeleted: false,
      isRejected: false,
      isApproved: true,
      briefType: { $in: Object.keys(briefTypeToPreferenceType) },
    };

    const rawMatches = await DB.Models.Property.find(finalQuery).lean();

    const withScore = rawMatches.map((property) => {
      const matchScore = calculateMatchScore(property, preference);
      const formatted = formatPropertyDataForTable(property);
      return {
        ...formatted,
        matchScore,
        isPriority: false, // temp placeholder
      };
    });

    // ✅ Filter out properties with 0 match score
    const filtered = withScore.filter((p) => p.matchScore > 0);

    // ✅ Separate into exact matches (score === 100) and partial matches
    const exactMatches = filtered.filter((p) => p.matchScore === 100);
    const partialMatches = filtered.filter((p) => p.matchScore < 100);

    // Sort each group by score (descending)
    exactMatches.sort((a, b) => b.matchScore - a.matchScore);
    partialMatches.sort((a, b) => b.matchScore - a.matchScore);

    // Merge so exact matches come first
    const sorted = [...exactMatches, ...partialMatches];

    // Mark top 80% as priority
    const cutoff = Math.ceil(sorted.length * 0.8);
    const prioritized = sorted.map((item, index) => ({
      ...item,
      isPriority: index < cutoff,
    }));

    // Pagination
    const paginated = prioritized.slice((+page - 1) * +limit, +page * +limit);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Matched properties ranked and formatted successfully",
      data: paginated,
      pagination: {
        total: prioritized.length,
        totalPages: Math.ceil(prioritized.length / +limit),
        page: +page,
        limit: +limit,
      },
    });
  } catch (err) {
    next(err);
  }
};
