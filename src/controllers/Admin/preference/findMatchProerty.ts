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
 * IMPROVED PROPERTY PREFERENCE MATCHING SYSTEM
 * ============================================================================
 *
 * CRITICAL FIXES:
 * 1. ✅ Proper preference type to property briefType mapping
 * 2. ✅ Strict DB-level filtering for all hard requirements
 * 3. ✅ Accurate scoring that reflects true match quality
 * 4. ✅ Better handling of optional vs required criteria
 *
 * MATCHING HIERARCHY:
 * 1. Preference Type (CRITICAL - must match briefType)
 * 2. Location (State → LGA → Area)
 * 3. Price Range (must be within budget)
 * 4. Bedrooms/Bathrooms (must meet minimum if specified)
 * 5. Property Type, Building Type, Condition (bonus if matches)
 * 6. Features and amenities (bonus points)
 * 7. Type-specific criteria (shortlet/JV)
 * ============================================================================
 */

/**
 * CORRECTED MAPPING: Preference Type → Property briefType
 * 
 * Preference uses: "buy" | "joint-venture" | "rent" | "shortlet"
 * Property uses: "sell" | "jv" | "rent" | "shortlet"
 */
const PREFERENCE_TO_BRIEF_TYPE: Record<string, string> = {
  "buy": "sell",
  "joint-venture": "jv", 
  "rent": "rent",
  "shortlet": "shortlet",
};

/**
 * Reverse mapping for validation and scoring
 */
const BRIEF_TYPE_TO_PREFERENCE: Record<string, string> = {
  "sell": "buy",
  "jv": "joint-venture",
  "rent": "rent",
  "shortlet": "shortlet",
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

    // Fetch preference
    const preference = await DB.Models.Preference.findById(preferenceId).lean();
    if (!preference) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Preference not found");
    }

    // ============================================================================
    // BUILD STRICT BASE QUERY - HARD REQUIREMENTS ONLY
    // ============================================================================
    
    const baseQuery: any = {
      isDeleted: false,
      isRejected: false,
      isApproved: true,
    };

    // ✅ 1. PREFERENCE TYPE MATCH (CRITICAL - MUST MATCH)
    const expectedBriefType = PREFERENCE_TO_BRIEF_TYPE[preference.preferenceType];
    if (!expectedBriefType) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        `Invalid preference type: ${preference.preferenceType}`
      );
    }
    baseQuery.briefType = expectedBriefType;

    // ✅ 2. LOCATION FILTERING (HIERARCHICAL)
    // Start with state (required)
    if (!preference.location?.state) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Preference must have a state specified"
      );
    }
    baseQuery["location.state"] = preference.location.state;

    // Filter by LGAs if specified
    if (preference.location?.localGovernmentAreas?.length) {
      baseQuery["location.localGovernment"] = {
        $in: preference.location.localGovernmentAreas,
      };
    }

    // Filter by specific areas if specified
    if (preference.location?.lgasWithAreas?.length) {
      const allAreas = preference.location.lgasWithAreas.flatMap(
        (lga) => lga.areas || []
      );
      if (allAreas.length > 0) {
        baseQuery["location.area"] = { $in: allAreas };
      }
    }

    // ✅ 3. PRICE FILTERING (STRICT RANGE)
    if (preference.budget?.minPrice != null || preference.budget?.maxPrice != null) {
      baseQuery.price = {};

      if (preference.budget.minPrice != null) {
        baseQuery.price.$gte = preference.budget.minPrice;
      }

      if (preference.budget.maxPrice != null) {
        baseQuery.price.$lte = preference.budget.maxPrice;
      }
    }

    // ✅ 4. BEDROOM FILTERING (MINIMUM REQUIREMENT)
    const minBedrooms =
      preference.propertyDetails?.minBedrooms ||
      preference.bookingDetails?.minBedrooms;

    if (minBedrooms) {
      const bedroomNum = parseInt(String(minBedrooms));
      if (!isNaN(bedroomNum) && bedroomNum > 0) {
        baseQuery["additionalFeatures.noOfBedroom"] = { $gte: bedroomNum };
      }
    }

    // ✅ 5. BATHROOM FILTERING (MINIMUM REQUIREMENT)
    const minBathrooms =
      preference.propertyDetails?.minBathrooms ||
      preference.bookingDetails?.minBathrooms;

    if (minBathrooms && minBathrooms > 0) {
      baseQuery["additionalFeatures.noOfBathroom"] = { $gte: minBathrooms };
    }

    // ✅ 6. PROPERTY TYPE FILTERING (IF SPECIFIED)
    const propertyType =
      preference.propertyDetails?.propertyType ||
      preference.bookingDetails?.propertyType;

    if (propertyType) {
      baseQuery.propertyType = propertyType;
    }

    // ✅ 7. BUILDING TYPE FILTERING (IF SPECIFIED)
    const buildingType =
      preference.propertyDetails?.buildingType ||
      preference.bookingDetails?.buildingType;

    if (buildingType) {
      baseQuery.typeOfBuilding = buildingType;
    }

    // ✅ 8. PROPERTY CONDITION FILTERING (IF SPECIFIED)
    const propertyCondition =
      preference.propertyDetails?.propertyCondition ||
      preference.bookingDetails?.propertyCondition;

    if (propertyCondition) {
      baseQuery.propertyCondition = propertyCondition;
    }

    // ✅ 9. SHORTLET-SPECIFIC FILTERING
    if (preference.preferenceType === "shortlet" && preference.bookingDetails) {
      // Filter by guest capacity
      if (preference.bookingDetails.numberOfGuests) {
        baseQuery["shortletDetails.maxGuests"] = {
          $gte: preference.bookingDetails.numberOfGuests,
        };
      }

      // Filter by availability (date range)
      if (
        preference.bookingDetails.checkInDate &&
        preference.bookingDetails.checkOutDate
      ) {
        const checkIn = new Date(preference.bookingDetails.checkInDate);
        const checkOut = new Date(preference.bookingDetails.checkOutDate);

        // Ensure property is not booked during requested period
        baseQuery.$or = [
          { bookedPeriods: { $exists: false } },
          { bookedPeriods: { $size: 0 } },
          {
            bookedPeriods: {
              $not: {
                $elemMatch: {
                  checkInDateTime: { $lt: checkOut },
                  checkOutDateTime: { $gt: checkIn },
                },
              },
            },
          },
        ];
      }

      // Filter by house rules (if user requires specific permissions)
      if (preference.contactInfo && 'petsAllowed' in preference.contactInfo) {
        const shortletContact = preference.contactInfo as any;
        
        if (shortletContact.petsAllowed === true) {
          baseQuery["shortletDetails.houseRules.pets"] = true;
        }
        if (shortletContact.smokingAllowed === true) {
          baseQuery["shortletDetails.houseRules.smoking"] = true;
        }
        if (shortletContact.partiesAllowed === true) {
          baseQuery["shortletDetails.houseRules.parties"] = true;
        }
      }
    }

    // ✅ 10. JOINT VENTURE SPECIFIC FILTERING
    if (preference.preferenceType === "joint-venture" && preference.developmentDetails) {
      // Filter by land size
      if (
        preference.developmentDetails.minLandSize ||
        preference.developmentDetails.maxLandSize
      ) {
        const minSize = preference.developmentDetails.minLandSize
          ? parseFloat(preference.developmentDetails.minLandSize)
          : 0;
        const maxSize = preference.developmentDetails.maxLandSize
          ? parseFloat(preference.developmentDetails.maxLandSize)
          : Infinity;

        if (!isNaN(minSize) && minSize > 0) {
          baseQuery["landSize.size"] = { $gte: minSize };
        }
        if (!isNaN(maxSize) && maxSize < Infinity) {
          baseQuery["landSize.size"] = baseQuery["landSize.size"] || {};
          baseQuery["landSize.size"].$lte = maxSize;
        }
      }

      // Filter by required documents (critical for JV)
      if (preference.developmentDetails.minimumTitleRequirements?.length) {
        // Property must have ALL required documents marked as provided
        const requiredDocs = preference.developmentDetails.minimumTitleRequirements;
        
        baseQuery.docOnProperty = {
          $all: requiredDocs.map((docName) => ({
            $elemMatch: {
              docName: docName,
              isProvided: true,
            },
          })),
        };
      }
    }

    // ============================================================================
    // FETCH MATCHING PROPERTIES
    // ============================================================================
    
    const rawMatches = await DB.Models.Property.find(baseQuery).lean();

    // ============================================================================
    // CALCULATE MATCH SCORES
    // ============================================================================
    
    const withScore = rawMatches.map((property) => {
      const matchScore = calculateDetailedMatchScore(property, preference);
      const formatted = formatPropertyDataForTable(property);
      return {
        ...formatted,
        matchScore,
        isPriority: false,
      };
    });

    // ✅ FILTERING: Only properties with 50-100% score
    // (Properties below 50% don't meet minimum criteria)
    const filtered = withScore.filter((p) => p.matchScore >= 50 && p.matchScore <= 100);

    // Sort by match score (descending)
    const sorted = filtered.sort((a, b) => b.matchScore - a.matchScore);

    // Mark top 80% as priority
    const priorityCutoff = Math.ceil(sorted.length * 0.8);
    const prioritized = sorted.map((item, index) => ({
      ...item,
      isPriority: index < priorityCutoff,
    }));

    // ============================================================================
    // PAGINATION
    // ============================================================================
    
    const paginated = prioritized.slice(
      (+page - 1) * +limit,
      +page * +limit
    );

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Properties matched successfully with strict criteria enforcement",
      data: paginated,
      pagination: {
        total: prioritized.length,
        totalPages: Math.ceil(prioritized.length / +limit),
        page: +page,
        limit: +limit,
      },
      matchingCriteria: {
        preferenceType: preference.preferenceType,
        propertyBriefType: expectedBriefType,
        location: {
          state: preference.location.state,
          lgas: preference.location.localGovernmentAreas,
          areas: preference.location.lgasWithAreas,
        },
        priceRange: {
          min: preference.budget?.minPrice,
          max: preference.budget?.maxPrice,
        },
        scoreRange: {
          minimum: 50,
          maximum: 100,
          description: "Scores reflect match quality. 100% = perfect match, 50% = minimum viable match",
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * ============================================================================
 * IMPROVED SCORING ALGORITHM
 * ============================================================================
 * 
 * SCORING BREAKDOWN:
 * - Base: 50 points (property passed all hard requirements)
 * - Preference Type Match: Auto-included (filtered at DB level)
 * - Location Precision: 0-15 points (state → LGA → area progression)
 * - Price Match: 0-15 points (within range gets full points)
 * - Bedrooms: 0-10 points (meets/exceeds minimum)
 * - Bathrooms: 0-10 points (meets/exceeds minimum)
 * - Property Type: 0-5 points (bonus if specified and matches)
 * - Building Type: 0-5 points (bonus if specified and matches)
 * - Condition: 0-5 points (bonus if specified and matches)
 * - Features: 0-10 points (proportional to matched features)
 * - Type-specific bonuses: 0-10 points (shortlet/JV extras)
 * 
 * Total possible: 50 (base) + 85 (bonuses) = 135, capped at 100
 */
function calculateDetailedMatchScore(property: any, preference: any): number {
  let score = 50; // Base score for passing hard requirements

  // ✅ 1. PREFERENCE TYPE - Already enforced at DB level, no scoring needed
  // Properties returned MUST match the preference type

  // ✅ 2. LOCATION PRECISION SCORING (0-15 points)
  let locationScore = 0;
  
  // State match (already enforced, but verify)
  if (property.location?.state === preference.location?.state) {
    locationScore += 5;

    // LGA match
    if (preference.location?.localGovernmentAreas?.length) {
      const lgaMatches = preference.location.localGovernmentAreas.includes(
        property.location?.localGovernment
      );
      if (lgaMatches) {
        locationScore += 5;

        // Specific area match
        if (preference.location?.lgasWithAreas?.length) {
          const allAreas = preference.location.lgasWithAreas.flatMap(
            (lga: any) => lga.areas || []
          );
          if (allAreas.includes(property.location?.area)) {
            locationScore += 5; // Most specific match
          }
        } else {
          locationScore += 5; // No area specified, LGA is sufficient
        }
      }
    } else {
      locationScore += 10; // No LGA/area preference, state match is sufficient
    }
  }
  
  score += locationScore;

  // ✅ 3. PRICE MATCH (0-15 points)
  // Property within exact budget range gets full points
  const minPrice = preference.budget?.minPrice || 0;
  const maxPrice = preference.budget?.maxPrice || Infinity;
  const propertyPrice = property.price || 0;

  if (propertyPrice >= minPrice && propertyPrice <= maxPrice) {
    score += 15; // Perfect price match
  }
  // If outside range, property shouldn't be here (DB filtering)
  // But if it somehow is, it gets 0 points

  // ✅ 4. BEDROOM MATCH (0-10 points)
  const minBedrooms =
    preference.propertyDetails?.minBedrooms ||
    preference.bookingDetails?.minBedrooms;

  if (minBedrooms) {
    const requiredBeds = parseInt(String(minBedrooms));
    const propertyBeds = property.additionalFeatures?.noOfBedroom || 0;
    
    if (propertyBeds >= requiredBeds) {
      // Award points based on how well it matches
      const excess = propertyBeds - requiredBeds;
      if (excess === 0) {
        score += 10; // Exact match
      } else if (excess <= 2) {
        score += 8; // Close match (1-2 extra bedrooms)
      } else {
        score += 5; // Has more than needed
      }
    }
  } else {
    score += 10; // No bedroom preference specified
  }

  // ✅ 5. BATHROOM MATCH (0-10 points)
  const minBathrooms =
    preference.propertyDetails?.minBathrooms ||
    preference.bookingDetails?.minBathrooms;

  if (minBathrooms) {
    const propertyBaths = property.additionalFeatures?.noOfBathroom || 0;
    
    if (propertyBaths >= minBathrooms) {
      const excess = propertyBaths - minBathrooms;
      if (excess === 0) {
        score += 10; // Exact match
      } else if (excess <= 1) {
        score += 8; // Close match
      } else {
        score += 5; // Has more than needed
      }
    }
  } else {
    score += 10; // No bathroom preference
  }

  // ✅ 6. PROPERTY TYPE BONUS (0-5 points)
  const preferredPropertyType =
    preference.propertyDetails?.propertyType ||
    preference.bookingDetails?.propertyType;

  if (preferredPropertyType) {
    if (property.propertyType === preferredPropertyType) {
      score += 5;
    }
  } else {
    score += 5; // No preference
  }

  // ✅ 7. BUILDING TYPE BONUS (0-5 points)
  const preferredBuildingType =
    preference.propertyDetails?.buildingType ||
    preference.bookingDetails?.buildingType;

  if (preferredBuildingType) {
    if (property.typeOfBuilding === preferredBuildingType) {
      score += 5;
    }
  } else {
    score += 5; // No preference
  }

  // ✅ 8. CONDITION BONUS (0-5 points)
  const preferredCondition =
    preference.propertyDetails?.propertyCondition ||
    preference.bookingDetails?.propertyCondition;

  if (preferredCondition) {
    if (property.propertyCondition === preferredCondition) {
      score += 5;
    }
  } else {
    score += 5; // No preference
  }

  // ✅ 9. FEATURES MATCH (0-10 points)
  if (preference.features?.baseFeatures?.length && property.features?.length) {
    const matchedFeatures = preference.features.baseFeatures.filter((f: string) =>
      property.features.includes(f)
    );
    const matchRatio = matchedFeatures.length / preference.features.baseFeatures.length;
    
    // Proportional scoring
    score += Math.round(matchRatio * 10);
  } else if (!preference.features?.baseFeatures?.length) {
    score += 10; // No feature preference
  }

  // ✅ 10. SHORTLET-SPECIFIC BONUSES (0-10 points)
  if (preference.preferenceType === "shortlet" && preference.bookingDetails) {
    let shortletBonus = 0;

    // Guest capacity match
    if (preference.bookingDetails.numberOfGuests) {
      const maxGuests = property.shortletDetails?.maxGuests || 0;
      if (maxGuests >= preference.bookingDetails.numberOfGuests) {
        const excess = maxGuests - preference.bookingDetails.numberOfGuests;
        if (excess <= 2) {
          shortletBonus += 5; // Perfect or close match
        } else {
          shortletBonus += 3; // Accommodates but much larger
        }
      }
    } else {
      shortletBonus += 5;
    }

    // House rules compatibility
    if (preference.contactInfo && 'petsAllowed' in preference.contactInfo) {
      const shortletContact = preference.contactInfo as any;
      let rulesScore = 0;
      let rulesChecked = 0;

      if (shortletContact.petsAllowed === true) {
        rulesChecked++;
        if (property.shortletDetails?.houseRules?.pets === true) rulesScore++;
      }
      if (shortletContact.smokingAllowed === true) {
        rulesChecked++;
        if (property.shortletDetails?.houseRules?.smoking === true) rulesScore++;
      }
      if (shortletContact.partiesAllowed === true) {
        rulesChecked++;
        if (property.shortletDetails?.houseRules?.parties === true) rulesScore++;
      }

      if (rulesChecked > 0) {
        shortletBonus += Math.round((rulesScore / rulesChecked) * 5);
      } else {
        shortletBonus += 5; // No special rules required
      }
    } else {
      shortletBonus += 5;
    }

    score += shortletBonus;
  }

  // ✅ 11. JOINT VENTURE BONUSES (0-10 points)
  if (preference.preferenceType === "joint-venture" && preference.developmentDetails) {
    let jvBonus = 0;

    // Land size match
    if (
      preference.developmentDetails.minLandSize ||
      preference.developmentDetails.maxLandSize
    ) {
      const minSize = preference.developmentDetails.minLandSize
        ? parseFloat(preference.developmentDetails.minLandSize)
        : 0;
      const maxSize = preference.developmentDetails.maxLandSize
        ? parseFloat(preference.developmentDetails.maxLandSize)
        : Infinity;
      const propertySize = property.landSize?.size || 0;

      if (propertySize >= minSize && propertySize <= maxSize) {
        jvBonus += 5; // Within desired range
      }
    } else {
      jvBonus += 5;
    }

    // Document compliance
    if (preference.developmentDetails.minimumTitleRequirements?.length) {
      const requiredDocs = preference.developmentDetails.minimumTitleRequirements;
      const propertyDocs = (property.docOnProperty || [])
        .filter((d: PropertyDocument) => d.isProvided)
        .map((d: PropertyDocument) => d.docName);

      const matchedDocs = requiredDocs.filter((doc: string) =>
        propertyDocs.includes(doc)
      );
      const docRatio = matchedDocs.length / requiredDocs.length;

      jvBonus += Math.round(docRatio * 5);
    } else {
      jvBonus += 5;
    }

    score += jvBonus;
  }

  // ============================================================================
  // FINAL SCORE CALCULATION
  // ============================================================================
  
  // Cap at 100
  const finalScore = Math.min(score, 100);
  
  return Math.round(finalScore);
}