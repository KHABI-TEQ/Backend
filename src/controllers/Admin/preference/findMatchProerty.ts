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
export const findMatchedProperties_old = async (
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

    // Build strict base query
    const baseQuery: any = {
      isDeleted: false,
      isRejected: false,
      isApproved: true,
      briefType: { $in: Object.keys(briefTypeToPreferenceType) },
    };

    // ✅ STRICT LOCATION MATCHING
    if (preference.location?.state) {
      baseQuery["location.state"] = preference.location.state;
    }

    // Filter by specific LGAs if provided
    if (preference.location?.localGovernmentAreas?.length) {
      baseQuery["location.localGovernment"] = {
        $in: preference.location.localGovernmentAreas,
      };
    }

    // Filter by specific areas within LGAs if provided
    if (preference.location?.lgasWithAreas?.length) {
      const areas = preference.location.lgasWithAreas.flatMap((lga) => lga.areas || []);
      if (areas.length > 0) {
        baseQuery["location.area"] = { $in: areas };
      }
    }

    // ✅ STRICT PRICE MATCHING
    if (preference.budget?.minPrice || preference.budget?.maxPrice) {
      baseQuery.price = {};
      
      if (preference.budget.minPrice) {
        baseQuery.price.$gte = preference.budget.minPrice;
      }
      
      if (preference.budget.maxPrice) {
        baseQuery.price.$lte = preference.budget.maxPrice;
      }
    }

    // ✅ STRICT BEDROOM MATCHING (for buy, rent, shortlet)
    const minBedrooms = 
      preference.propertyDetails?.minBedrooms || 
      preference.bookingDetails?.minBedrooms;
    
    if (minBedrooms) {
      const bedroomNum = parseInt(minBedrooms);
      if (!isNaN(bedroomNum)) {
        baseQuery["additionalFeatures.noOfBedroom"] = { $gte: bedroomNum };
      }
    }

    // ✅ STRICT BATHROOM MATCHING
    const minBathrooms = 
      preference.propertyDetails?.minBathrooms || 
      preference.bookingDetails?.minBathrooms;
    
    if (minBathrooms) {
      baseQuery["additionalFeatures.noOfBathroom"] = { $gte: minBathrooms };
    }

    // ✅ PROPERTY TYPE MATCHING
    const propertyType = 
      preference.propertyDetails?.propertyType || 
      preference.bookingDetails?.propertyType;
    
    if (propertyType) {
      baseQuery.propertyType = propertyType;
    }

    // ✅ BUILDING TYPE MATCHING
    const buildingType = 
      preference.propertyDetails?.buildingType || 
      preference.bookingDetails?.buildingType;
    
    if (buildingType) {
      baseQuery.typeOfBuilding = buildingType;
    }

    // ✅ PROPERTY CONDITION MATCHING
    const propertyCondition = 
      preference.propertyDetails?.propertyCondition || 
      preference.bookingDetails?.propertyCondition;
    
    if (propertyCondition) {
      baseQuery.propertyCondition = propertyCondition;
    }

    // ✅ SHORTLET-SPECIFIC MATCHING
    if (preference.preferenceType === "shortlet" && preference.bookingDetails) {
      // Match number of guests
      if (preference.bookingDetails.numberOfGuests) {
        baseQuery["shortletDetails.maxGuests"] = {
          $gte: preference.bookingDetails.numberOfGuests,
        };
      }

      // Match check-in/check-out availability
      if (preference.bookingDetails.checkInDate && preference.bookingDetails.checkOutDate) {
        const checkIn = new Date(preference.bookingDetails.checkInDate);
        const checkOut = new Date(preference.bookingDetails.checkOutDate);
        
        // Ensure property is not already booked during this period
        baseQuery.$or = [
          { bookedPeriods: { $exists: false } },
          { bookedPeriods: { $size: 0 } },
          {
            bookedPeriods: {
              $not: {
                $elemMatch: {
                  $or: [
                    {
                      checkInDateTime: { $lte: checkOut },
                      checkOutDateTime: { $gte: checkIn },
                    },
                  ],
                },
              },
            },
          },
        ];
      }

      // Match pets/smoking/parties preferences
      if (preference.contactInfo && 'petsAllowed' in preference.contactInfo) {
        if (preference.contactInfo.petsAllowed) {
          baseQuery["shortletDetails.houseRules.pets"] = true;
        }
        if (preference.contactInfo.smokingAllowed) {
          baseQuery["shortletDetails.houseRules.smoking"] = true;
        }
        if (preference.contactInfo.partiesAllowed) {
          baseQuery["shortletDetails.houseRules.parties"] = true;
        }
      }
    }

    // ✅ JOINT VENTURE SPECIFIC MATCHING
    if (preference.preferenceType === "joint-venture" && preference.developmentDetails) {
      // Match land size for joint ventures
      if (preference.developmentDetails.minLandSize) {
        const minSize = parseFloat(preference.developmentDetails.minLandSize);
        if (!isNaN(minSize)) {
          baseQuery["landSize.size"] = { $gte: minSize };
        }
      }
      
      if (preference.developmentDetails.maxLandSize) {
        const maxSize = parseFloat(preference.developmentDetails.maxLandSize);
        if (!isNaN(maxSize)) {
          baseQuery["landSize.size"] = baseQuery["landSize.size"] || {};
          baseQuery["landSize.size"].$lte = maxSize;
        }
      }

      // Match document requirements
      if (preference.developmentDetails.minimumTitleRequirements?.length) {
        baseQuery["docOnProperty.docName"] = {
          $in: preference.developmentDetails.minimumTitleRequirements,
        };
        baseQuery["docOnProperty.isProvided"] = true;
      }
    }

    // Fetch matching properties
    const rawMatches = await DB.Models.Property.find(baseQuery).lean();

    // Calculate detailed match scores
    const withScore = rawMatches.map((property) => {
      const matchScore = calculateDetailedMatchScore(property, preference);
      const formatted = formatPropertyDataForTable(property);
      return {
        ...formatted,
        matchScore,
        isPriority: false,
      };
    });

    // ✅ Filter out properties with low match scores (below 50%)
    const filtered = withScore.filter((p) => p.matchScore >= 50);

    // Sort by match score (descending)
    const sorted = filtered.sort((a, b) => b.matchScore - a.matchScore);

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

/**
 * Calculate detailed match score with weighted criteria
 */
function calculateDetailedMatchScore(property: any, preference: any): number {
  let score = 0;
  let maxScore = 0;

  // ✅ LOCATION SCORING (Weight: 30 points)
  maxScore += 30;
  if (property.location?.state === preference.location?.state) {
    score += 15; // State match
    
    if (preference.location?.localGovernmentAreas?.length) {
      if (preference.location.localGovernmentAreas.includes(property.location?.localGovernment)) {
        score += 10; // LGA match
      }
    } else {
      score += 10; // No LGA preference, give full points
    }
    
    if (preference.location?.lgasWithAreas?.length) {
      const allAreas = preference.location.lgasWithAreas.flatMap((lga: any) => lga.areas || []);
      if (allAreas.includes(property.location?.area)) {
        score += 5; // Area match
      }
    } else {
      score += 5; // No area preference, give full points
    }
  }

  // ✅ PRICE SCORING (Weight: 25 points)
  maxScore += 25;
  if (property.price) {
    const minPrice = preference.budget?.minPrice || 0;
    const maxPrice = preference.budget?.maxPrice || Infinity;
    
    if (property.price >= minPrice && property.price <= maxPrice) {
      score += 25; // Price within range
    } else if (property.price < minPrice) {
      // Below minimum - partial points based on how close
      const diff = minPrice - property.price;
      const tolerance = minPrice * 0.2; // 20% tolerance
      if (diff <= tolerance) {
        score += Math.round(25 * (1 - diff / tolerance));
      }
    } else {
      // Above maximum - partial points based on how close
      const diff = property.price - maxPrice;
      const tolerance = maxPrice * 0.2; // 20% tolerance
      if (diff <= tolerance) {
        score += Math.round(25 * (1 - diff / tolerance));
      }
    }
  }

  // ✅ BEDROOM SCORING (Weight: 15 points)
  maxScore += 15;
  const minBedrooms = 
    preference.propertyDetails?.minBedrooms || 
    preference.bookingDetails?.minBedrooms;
  
  if (minBedrooms) {
    const requiredBedrooms = parseInt(minBedrooms);
    const propertyBedrooms = property.additionalFeatures?.noOfBedroom || 0;
    
    if (propertyBedrooms >= requiredBedrooms) {
      score += 15; // Meets or exceeds requirement
    } else if (propertyBedrooms === requiredBedrooms - 1) {
      score += 10; // One bedroom short
    }
  } else {
    score += 15; // No bedroom preference
  }

  // ✅ BATHROOM SCORING (Weight: 10 points)
  maxScore += 10;
  const minBathrooms = 
    preference.propertyDetails?.minBathrooms || 
    preference.bookingDetails?.minBathrooms;
  
  if (minBathrooms) {
    const propertyBathrooms = property.additionalFeatures?.noOfBathroom || 0;
    
    if (propertyBathrooms >= minBathrooms) {
      score += 10;
    } else if (propertyBathrooms === minBathrooms - 1) {
      score += 5;
    }
  } else {
    score += 10;
  }

  // ✅ PROPERTY TYPE SCORING (Weight: 10 points)
  maxScore += 10;
  const preferredPropertyType = 
    preference.propertyDetails?.propertyType || 
    preference.bookingDetails?.propertyType;
  
  if (preferredPropertyType) {
    if (property.propertyType === preferredPropertyType) {
      score += 10;
    }
  } else {
    score += 10;
  }

  // ✅ FEATURES SCORING (Weight: 10 points)
  maxScore += 10;
  if (preference.features?.baseFeatures?.length && property.features?.length) {
    const matchedFeatures = preference.features.baseFeatures.filter((f: string) =>
      property.features.includes(f)
    );
    const featureMatchRatio = matchedFeatures.length / preference.features.baseFeatures.length;
    score += Math.round(featureMatchRatio * 10);
  } else {
    score += 10;
  }

  // Calculate percentage
  return Math.round((score / maxScore) * 100);
}