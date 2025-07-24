import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";

// Utility: Calculate score based on how well a property matches the preference
const calculateMatchScore = (property: any, preference: any): number => {
  let score = 0;

  // Location match (30%)
  if (
    property.location?.localGovernment &&
    preference.location?.localGovernmentAreas?.includes(property.location.localGovernment)
  ) {
    score += 30;
  }

  // Budget match (40%)
  const price = property.price ?? 0;
  if (
    preference.budgetMin != null &&
    preference.budgetMax != null &&
    price >= preference.budgetMin &&
    price <= preference.budgetMax
  ) {
    score += 40;
  }

  // Property category match (30%)
  const categoryMap: any = {
    "Outright Sales": "buy",
    "Rent": "rent",
    "Joint Venture": "joint-venture",
    "Shortlet": "shortlet",
  };

  const mapped = categoryMap[property.propertyCategory];
  if (mapped && mapped === preference.preferenceType) {
    score += 30;
  }

  // Optional bedroom match (bonus)
  const minBed = preference.propertyDetails?.minBedrooms;
  if (minBed && property.additionalFeatures?.noOfBedroom >= minBed) {
    score += 5;
  }

  // Optional bathroom match (bonus)
  const minBath = preference.propertyDetails?.minBathrooms;
  if (minBath && property.additionalFeatures?.noOfBathroom >= minBath) {
    score += 5;
  }

  return Math.min(score, 100); // Cap at 100
};

// Main controller
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

    // Query for properties matching basic criteria (expand as needed)
    const finalQuery: any = {
      "location.state": preference.location?.state,
      listingStatus: "listed",
      isPublished: true,
      isDraft: false,
    };

    const rawMatches = await DB.Models.Property.find(finalQuery)
      .populate("agent")
      .lean();

    // Apply scoring
    const withScore = rawMatches.map((property) => ({
      ...property,
      matchScore: calculateMatchScore(property, preference),
    }));

    // Sort descending by score
    withScore.sort((a, b) => b.matchScore - a.matchScore);

    // Flag top 80% as priority
    const cutoff = Math.ceil(withScore.length * 0.8);
    const prioritized = withScore.map((item, index) => ({
      ...item,
      isPriority: index < cutoff,
      quickView: {
        _id: item._id,
        title: [
          item.location?.area,
          item.location?.localGovernment,
          item.location?.state
        ]
          .filter(Boolean)
          .join(", "),
        location: item.location,
        price: item.price,
        propertyCategory: item.propertyCategory,
        briefType: item.briefType,
        createdAt: item.createdAt,
      },
    }));

    // Pagination
    const paginated = prioritized.slice(
      (+page - 1) * +limit,
      +page * +limit
    );

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Matched properties ranked and fetched successfully",
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
