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
 * 1. ✅ Proper preference type to property propertyType mapping
 * 2. ✅ Strict DB-level filtering for MUST MATCH criteria only
 * 3. ✅ Accurate scoring that reflects true match quality
 * 4. ✅ Clear separation between REQUIRED and OPTIONAL criteria
 *
 * MATCHING HIERARCHY:
 * 
 * === MUST MATCH (Hard Requirements - Filtered at DB Level) ===
 * 1. propertyType (preference type → property propertyType mapping)
 * 2. Location State (MUST match exactly)
 * 3. Location LGA (MUST match if specified)
 * 4. Price Range (MUST be within budget)
 * 
 * === OPTIONAL (Bonus Scoring - Not Filtered at DB) ===
 * 5. Location Area (within LGA - bonus points if matches)
 * 6. Bedrooms/Bathrooms (bonus points if meets/exceeds preference)
 * 7. Property Type (bonus points if matches)
 * 8. Building Type (bonus points if matches)
 * 9. Condition (bonus points if matches)
 * 10. Features and amenities (bonus points proportional to matches)
 * 11. Type-specific criteria (shortlet dates/rules, JV docs/land size)
 * 
 * SCORING:
 * - Base score: 50 points (for passing MUST MATCH criteria)
 * - Bonus points: 0-50 points (for OPTIONAL criteria matches)
 * - Final range: 50-100% (properties sorted by score, highest first)
 * ============================================================================
 */

/**
 * CORRECTED MAPPING: Preference Type → Property propertyType
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
    baseQuery.propertyType = expectedBriefType;

    // ✅ 2. LOCATION FILTERING (HIERARCHICAL)
    // Start with state (REQUIRED - MUST MATCH)
    if (!preference.location?.state) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Preference must have a state specified"
      );
    }
    baseQuery["location.state"] = preference.location.state;

    // LGA is REQUIRED - MUST MATCH
    if (preference.location?.localGovernmentAreas?.length) {
      baseQuery["location.localGovernment"] = {
        $in: preference.location.localGovernmentAreas,
      };
    }

    // Areas within LGA are OPTIONAL (bonus scoring only)
    // Not filtered at DB level - scored in calculateDetailedMatchScore

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

    // ✅ 4. OPTIONAL CRITERIA (NOT FILTERED - SCORED ONLY)
    // These are not hard requirements at DB level
    // They provide bonus points in the scoring algorithm:
    // - Bedrooms/Bathrooms (min requirements give bonus points)
    // - Property Type (if matches, bonus points)
    // - Building Type (if matches, bonus points)  
    // - Property Condition (if matches, bonus points)
    // All scoring is done in calculateDetailedMatchScore function

    // ✅ 5. SHORTLET-SPECIFIC FILTERING (OPTIONAL)
    // These are treated as optional bonus criteria for shortlets
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

    // ✅ 6. JOINT VENTURE SPECIFIC FILTERING (OPTIONAL)
    // These are treated as optional bonus criteria for JV
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
 * Properties are pre-filtered by MUST MATCH criteria:
 * - propertyType (preference type)
 * - Location State
 * - Location LGA (if specified)
 * - Price Range
 * 
 * SCORING BREAKDOWN (for properties that passed MUST MATCH):
 * - Base: 50 points (automatic for passing hard requirements)
 * 
 * BONUS POINTS (0-50 total):
 * - Location Area Match: 0-10 points (if preference specifies areas)
 * - Bedroom Match: 0-10 points (meets/exceeds minimum preference)
 * - Bathroom Match: 0-10 points (meets/exceeds minimum preference)
 * - Property Type: 0-5 points (if matches preference)
 * - Building Type: 0-5 points (if matches preference)
 * - Condition: 0-5 points (if matches preference)
 * - Features: 0-10 points (proportional to matched features)
 * - Type-specific bonuses: 0-15 points (shortlet/JV extras)
 * 
 * Total possible: 50 (base) + 70 (bonuses) = 120, capped at 100
 * Final range: 50-100% (sorted highest first)
 */
function calculateDetailedMatchScore(property: any, preference: any): number {
  let score = 50; // Base score for passing hard requirements

  // ✅ 1. LOCATION AREA BONUS (0-10 points)
  // State and LGA already matched at DB level
  // Award bonus points if property is in a preferred area (if specified)
  let locationScore = 0;
  
  if (preference.location?.lgasWithAreas?.length) {
    const allPreferredAreas = preference.location.lgasWithAreas.flatMap(
      (lga: any) => lga.areas || []
    );
    
    if (allPreferredAreas.length > 0) {
      const propertyArea = property.location?.area;
      if (propertyArea && allPreferredAreas.includes(propertyArea)) {
        locationScore = 10; // Property in preferred area - bonus!
      }
      // If not in preferred area, 0 bonus (but still valid since LGA matched)
    } else {
      locationScore = 10; // No specific areas specified - full bonus
    }
  } else {
    locationScore = 10; // No area preference - full bonus
  }
  
  score += locationScore;

  // ✅ 2. BEDROOM MATCH (0-10 points)
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

  // ✅ 3. BATHROOM MATCH (0-10 points)
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

  // ✅ 4. PROPERTY TYPE BONUS (0-5 points)
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

  // ✅ 5. BUILDING TYPE BONUS (0-5 points)
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

  // ✅ 6. CONDITION BONUS (0-5 points)
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

  // ✅ 7. FEATURES MATCH (0-10 points)
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

  // ✅ 8. SHORTLET-SPECIFIC BONUSES (0-15 points)
  if (preference.preferenceType === "shortlet" && preference.bookingDetails) {
    let shortletBonus = 0;

    // Guest capacity match (0-8 points)
    if (preference.bookingDetails.numberOfGuests) {
      const maxGuests = property.shortletDetails?.maxGuests || 0;
      if (maxGuests >= preference.bookingDetails.numberOfGuests) {
        const excess = maxGuests - preference.bookingDetails.numberOfGuests;
        if (excess <= 2) {
          shortletBonus += 8; // Perfect or close match
        } else {
          shortletBonus += 5; // Accommodates but much larger
        }
      }
    } else {
      shortletBonus += 8;
    }

    // House rules compatibility (0-7 points)
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
        shortletBonus += Math.round((rulesScore / rulesChecked) * 7);
      } else {
        shortletBonus += 7; // No special rules required
      }
    } else {
      shortletBonus += 7;
    }

    score += shortletBonus;
  }

  // ✅ 9. JOINT VENTURE BONUSES (0-15 points)
  if (preference.preferenceType === "joint-venture" && preference.developmentDetails) {
    let jvBonus = 0;

    // Land size match (0-8 points)
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
        jvBonus += 8; // Within desired range
      }
    } else {
      jvBonus += 8;
    }

    // Document compliance (0-7 points)
    if (preference.developmentDetails.minimumTitleRequirements?.length) {
      const requiredDocs = preference.developmentDetails.minimumTitleRequirements;
      const propertyDocs = (property.docOnProperty || [])
        .filter((d: PropertyDocument) => d.isProvided)
        .map((d: PropertyDocument) => d.docName);

      const matchedDocs = requiredDocs.filter((doc: string) =>
        propertyDocs.includes(doc)
      );
      const docRatio = matchedDocs.length / requiredDocs.length;

      jvBonus += Math.round(docRatio * 7);
    } else {
      jvBonus += 7;
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