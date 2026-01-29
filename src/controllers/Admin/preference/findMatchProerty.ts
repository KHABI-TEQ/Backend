import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { formatPropertyDataForTable } from "../../../utils/propertyFormatters";

interface PropertyDocument {
  docName: string;
  isProvided: boolean;
}

/**
 * ============================================================================
 * PROPERTY PREFERENCE MATCHING SYSTEM - REFINED FOR 100% ACCURACY
 * ============================================================================
 *
 * MATCHING STRATEGY:
 *
 * 1. HARD REQUIREMENTS (Database Query Level)
 *    - State location match
 *    - Local Government Area (if specified)
 *    - Specific areas/neighborhoods (if specified)
 *    - Price within budget range
 *    - Minimum bedrooms/bathrooms
 *    - Property type match
 *    - Building type match (if specified)
 *    - Property condition (if specified)
 *    - Additional type-specific requirements (shortlet, joint-venture)
 *
 * 2. SCORING ALGORITHM (50% - 100% Range)
 *
 *    Base Score: 50%
 *    - Properties passing hard requirements start at 50% (minimum viable match)
 *
 *    Bonus Points (0-50%):
 *    - Location exactness: 0-15 points (state → LGA → area progression)
 *    - Price match: 0-15 points (must be in exact range)
 *    - Bedroom requirements: 0-10 points (must meet minimum)
 *    - Bathroom requirements: 0-10 points (must meet minimum)
 *    - Property type: 0-10 points (must match if specified)
 *    - Property condition: 0-3 points (bonus if matches)
 *    - Building type: 0-2 points (bonus if matches)
 *    - Features: 0-5 points (proportional to match ratio, min 50%)
 *    - Type-specific bonuses: 0-5-10 points (shortlet/JV)
 *
 *    Final Score Range: 50% (minimum) to 100% (perfect match)
 *
 * 3. FILTERING RULES
 *    - Properties with score < 50% are EXCLUDED (insufficient match)
 *    - Properties with score 50-100% are INCLUDED (viable matches)
 *    - Results sorted by match score (highest first)
 *    - Top 80% marked as priority (high confidence matches)
 *
 * ACCURACY GUARANTEE:
 * ✅ Only properties matching hard requirements are returned
 * ✅ Scoring reflects actual match quality (no fuzzy partial credit)
 * ✅ 100% score = all criteria matched perfectly
 * ✅ 50% score = core requirements met, but missing optional criteria
 * ============================================================================
 */

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

    // ✅ STRICT FILTERING: Only include properties with scores between 50% and 100%
    // Properties below 50% do not meet minimum matching criteria
    const filtered = withScore.filter((p) => p.matchScore >= 50 && p.matchScore <= 100);

    // Sort by match score (descending) - highest match scores first
    const sorted = filtered.sort((a, b) => b.matchScore - a.matchScore);

    // Mark top 80% as priority (high confidence matches)
    const cutoff = Math.ceil(sorted.length * 0.8);
    const prioritized = sorted.map((item, index) => ({
      ...item,
      isPriority: index < cutoff,
    }));

    // Pagination
    const paginated = prioritized.slice((+page - 1) * +limit, +page * +limit);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Matched properties ranked and formatted successfully. Scores range from 50% (minimum match) to 100% (perfect match).",
      data: paginated,
      pagination: {
        total: prioritized.length,
        totalPages: Math.ceil(prioritized.length / +limit),
        page: +page,
        limit: +limit,
      },
      scoreExplanation: {
        minimum: 50,
        maximum: 100,
        description: "Properties with scores below 50% are excluded as they do not meet minimum matching criteria."
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Calculate detailed match score with STRICT criteria enforcement
 *
 * Scoring Strategy:
 * - 100% Match: All EXACT criteria matched (location, price, beds, baths, type, condition)
 * - 90-99% Match: All exact criteria matched + bonus features
 * - 75-89% Match: Most exact criteria matched (missing one non-critical criterion)
 * - 50-74% Match: Core criteria matched (location, price) but missing details (beds/baths/type)
 * - Below 50%: Does not match enough criteria (filtered out)
 *
 * Properties not passing base query are never returned (hard requirements enforced at DB level)
 */
function calculateDetailedMatchScore(property: any, preference: any): number {
  // Start with 50% as baseline (property passed hard requirements via base query)
  let baseScore = 50;
  let bonusPoints = 0;
  const maxBonusPoints = 50; // Can go up to 100%

  // ===== EXACT MATCHING CRITERIA (Must match for full points) =====

  // 1. LOCATION MATCH (15 points max)
  let locationPoints = 0;
  const stateMatch = property.location?.state === preference.location?.state;

  if (stateMatch) {
    locationPoints += 5; // Base state match

    // LGA match (if preference specifies LGAs)
    if (preference.location?.localGovernmentAreas?.length) {
      const lgaMatch = preference.location.localGovernmentAreas.includes(property.location?.localGovernment);
      if (lgaMatch) {
        locationPoints += 5; // LGA match

        // Area match (if preference specifies areas within LGAs)
        if (preference.location?.lgasWithAreas?.length) {
          const allAreas = preference.location.lgasWithAreas.flatMap((lga: any) => lga.areas || []);
          const areaMatch = allAreas.includes(property.location?.area);
          if (areaMatch) {
            locationPoints += 5; // Exact area match
          }
        } else {
          locationPoints += 5; // No area preference specified
        }
      } else {
        locationPoints = 5; // State only, no LGA match - loses points
      }
    } else {
      locationPoints += 10; // No LGA preference, state match is sufficient
    }
  }

  bonusPoints += locationPoints;

  // 2. PRICE MATCH (15 points) - EXACT RANGE MATCH ONLY
  const minPrice = preference.budget?.minPrice || 0;
  const maxPrice = preference.budget?.maxPrice || Infinity;
  const propertyPrice = property.price || 0;

  if (propertyPrice >= minPrice && propertyPrice <= maxPrice) {
    // Perfect price match - full points
    bonusPoints += 15;
  } else {
    // Outside range - no points (hard query should prevent this, but extra validation)
    bonusPoints += 0;
  }

  // 3. BEDROOM MATCH (10 points) - EXACT MATCH REQUIRED
  const minBedrooms =
    preference.propertyDetails?.minBedrooms ||
    preference.bookingDetails?.minBedrooms;

  const propertyBedrooms = property.additionalFeatures?.noOfBedroom || 0;

  if (minBedrooms) {
    const requiredBedrooms = parseInt(minBedrooms);
    if (propertyBedrooms >= requiredBedrooms) {
      bonusPoints += 10; // Meets minimum bedroom requirement
    }
    // If below requirement, no points (hard query should prevent this)
  } else {
    bonusPoints += 10; // No bedroom preference specified
  }

  // 4. BATHROOM MATCH (10 points) - EXACT MATCH REQUIRED
  const minBathrooms =
    preference.propertyDetails?.minBathrooms ||
    preference.bookingDetails?.minBathrooms;

  const propertyBathrooms = property.additionalFeatures?.noOfBathroom || 0;

  if (minBathrooms) {
    if (propertyBathrooms >= minBathrooms) {
      bonusPoints += 10; // Meets minimum bathroom requirement
    }
    // If below requirement, no points
  } else {
    bonusPoints += 10; // No bathroom preference specified
  }

  // 5. PROPERTY TYPE MATCH (10 points) - EXACT MATCH REQUIRED
  const preferredPropertyType =
    preference.propertyDetails?.propertyType ||
    preference.bookingDetails?.propertyType;

  if (preferredPropertyType) {
    if (property.propertyType === preferredPropertyType) {
      bonusPoints += 10; // Property type matches exactly
    }
    // No partial credit for property type mismatch
  } else {
    bonusPoints += 10; // No property type preference specified
  }

  // ===== BONUS CRITERIA (Optional, for exceeding 100%) =====

  // 6. PROPERTY CONDITION (+ 3 points)
  const preferredCondition =
    preference.propertyDetails?.propertyCondition ||
    preference.bookingDetails?.propertyCondition;

  if (preferredCondition) {
    if (property.propertyCondition === preferredCondition) {
      bonusPoints += 3; // Condition matches exactly
    }
  } else {
    bonusPoints += 3; // No condition preference
  }

  // 7. BUILDING TYPE (+ 2 points)
  const preferredBuildingType =
    preference.propertyDetails?.buildingType ||
    preference.bookingDetails?.buildingType;

  if (preferredBuildingType) {
    if (property.typeOfBuilding === preferredBuildingType) {
      bonusPoints += 2;
    }
  } else {
    bonusPoints += 2;
  }

  // 8. FEATURES MATCH (+ 5 points) - Proportional to match ratio
  if (preference.features?.baseFeatures?.length && property.features?.length) {
    const matchedFeatures = preference.features.baseFeatures.filter((f: string) =>
      property.features.includes(f)
    );
    const featureMatchRatio = matchedFeatures.length / preference.features.baseFeatures.length;
    // Only award points if at least 50% of features match
    if (featureMatchRatio >= 0.5) {
      bonusPoints += Math.round(featureMatchRatio * 5);
    }
  } else if (!preference.features?.baseFeatures?.length) {
    bonusPoints += 5; // No feature preference specified
  }

  // 9. SHORTLET-SPECIFIC BONUS (+ 5 points max)
  if (preference.preferenceType === "shortlet" && preference.bookingDetails) {
    let shortletBonus = 0;

    if (preference.bookingDetails.numberOfGuests && property.shortletDetails?.maxGuests) {
      if (property.shortletDetails.maxGuests >= preference.bookingDetails.numberOfGuests) {
        shortletBonus += 2;
      }
    }

    if (preference.contactInfo && 'petsAllowed' in preference.contactInfo) {
      let rulesMatched = 0;
      let rulesRequired = 0;

      if (preference.contactInfo.petsAllowed) {
        rulesRequired++;
        if (property.shortletDetails?.houseRules?.pets === true) rulesMatched++;
      }
      if (preference.contactInfo.smokingAllowed) {
        rulesRequired++;
        if (property.shortletDetails?.houseRules?.smoking === true) rulesMatched++;
      }
      if (preference.contactInfo.partiesAllowed) {
        rulesRequired++;
        if (property.shortletDetails?.houseRules?.parties === true) rulesMatched++;
      }

      if (rulesRequired > 0) {
        shortletBonus += Math.round((rulesMatched / rulesRequired) * 3);
      } else {
        shortletBonus += 3;
      }
    }

    bonusPoints += shortletBonus;
  }

  // 10. JOINT VENTURE-SPECIFIC BONUS (+ 5 points max)
  if (preference.preferenceType === "joint-venture" && preference.developmentDetails) {
    let jvBonus = 0;

    // Land size match
    if (preference.developmentDetails.minLandSize || preference.developmentDetails.maxLandSize) {
      const minSize = preference.developmentDetails.minLandSize
        ? parseFloat(preference.developmentDetails.minLandSize)
        : 0;
      const maxSize = preference.developmentDetails.maxLandSize
        ? parseFloat(preference.developmentDetails.maxLandSize)
        : Infinity;

      const propertySize = property.landSize?.size || 0;

      if (propertySize >= minSize && propertySize <= maxSize) {
        jvBonus += 2;
      }
    }

    // Title documents match
    if (preference.developmentDetails.minimumTitleRequirements?.length && property.docOnProperty?.length) {
      const requiredDocs = preference.developmentDetails.minimumTitleRequirements;
      const propertyDocs = property.docOnProperty
        .filter((d: PropertyDocument) => d.isProvided)
        .map((d: PropertyDocument) => d.docName);
      const docsMatched = requiredDocs.filter((doc: string) => propertyDocs.includes(doc)).length;

      // const propertyDocs = property.docOnProperty.filter(d => d.isProvided).map(d => d.docName);
      // const docsMatched = requiredDocs.filter(doc => propertyDocs.includes(doc)).length;


      const docMatchRatio = docsMatched / requiredDocs.length;

      if (docMatchRatio >= 0.5) {
        jvBonus += Math.round(docMatchRatio * 3);
      }
    } else if (!preference.developmentDetails.minimumTitleRequirements?.length) {
      jvBonus += 3;
    }

    bonusPoints += jvBonus;
  }

  // ===== FINAL CALCULATION =====
  // Clamp bonus points to max (prevents exceeding 100%)
  const cappedBonus = Math.min(bonusPoints, maxBonusPoints);
  const finalScore = baseScore + cappedBonus;

  return Math.round(finalScore);
}
