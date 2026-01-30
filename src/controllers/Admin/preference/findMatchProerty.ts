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
 * PROPERTY PREFERENCE MATCHING SYSTEM
 * ============================================================================
 *
 * MATCHING HIERARCHY:
 * 
 * === MUST MATCH (Hard Requirements - Filtered at DB Level) ===
 * 1. Property Type (preference type → property propertyType mapping) - REQUIRED
 * 2. Location State - REQUIRED (MUST match exactly)
 * 3. Location LGA - REQUIRED (MUST match exactly)
 * 4. Price Range - REQUIRED (MUST be within budget)
 * 
 * === OPTIONAL (Bonus Scoring - Not Filtered at DB) ===
 * 5. Location Area (within LGA - bonus points if matches)
 * 6. Bedrooms/Bathrooms (bonus points if meets/exceeds preference)
 * 7. Building Type (bonus points if matches)
 * 8. Condition (bonus points if matches)
 * 9. Features and amenities (bonus points proportional to matches)
 * 10. Type-specific criteria (shortlet dates/rules, JV docs/land size)
 * 
 * SCORING:
 * - Base score: 50 points (for passing MUST MATCH criteria)
 * - Bonus points: 0-50 points (for OPTIONAL criteria matches)
 * - Final range: 50-100% (properties sorted by score, highest first)
 * ============================================================================
 */

/**
 * MAPPING: Preference Type → Property propertyType
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
    // BUILD STRICT BASE QUERY - MUST MATCH CRITERIA ONLY
    // ============================================================================
    
    const baseQuery: any = {
      isDeleted: false,
      isRejected: false,
      isApproved: true,
    };

    // ✅ 1. PROPERTY TYPE - MUST MATCH (CRITICAL)
    const expectedBriefType = PREFERENCE_TO_BRIEF_TYPE[preference.preferenceType];
    if (!expectedBriefType) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        `Invalid preference type: ${preference.preferenceType}`
      );
    }
    baseQuery.propertyType = expectedBriefType;

    // ✅ 2. LOCATION STATE - MUST MATCH (REQUIRED)
    if (!preference.location?.state) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Preference must have a state specified"
      );
    }
    baseQuery["location.state"] = preference.location.state;

    // ✅ 3. LOCATION LGA - MUST MATCH (REQUIRED)
    if (!preference.location?.localGovernmentAreas?.length) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Preference must have at least one LGA specified"
      );
    }
    baseQuery["location.localGovernment"] = {
      $in: preference.location.localGovernmentAreas,
    };

    // ✅ 4. PRICE RANGE - MUST MATCH (REQUIRED)
    // Property price MUST be within the preference budget range
    if (preference.budget?.minPrice != null || preference.budget?.maxPrice != null) {
      baseQuery.price = {};

      if (preference.budget.minPrice != null) {
        baseQuery.price.$gte = preference.budget.minPrice;
      }

      if (preference.budget.maxPrice != null) {
        baseQuery.price.$lte = preference.budget.maxPrice;
      }
    }

    // ============================================================================
    // NOTE: ALL OTHER CRITERIA ARE OPTIONAL
    // ============================================================================
    // The following are NOT filtered at DB level but scored as bonuses:
    // - Location Area (within LGA)
    // - Bedrooms/Bathrooms
    // - Building Type
    // - Property Condition
    // - Features
    // - Shortlet-specific (dates, guest capacity, house rules)
    // - Joint Venture-specific (land size, documents)
    // 
    // These provide bonus points in the scoring algorithm (0-50 points)
    // ============================================================================

    // ============================================================================
    // FETCH MATCHING PROPERTIES
    // ============================================================================
    
    const rawMatches = await DB.Models.Property.find(baseQuery).lean();

    if (rawMatches.length === 0) {
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: "No properties match the required criteria",
        data: [],
        pagination: {
          total: 0,
          totalPages: 0,
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
        },
      });
    }

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

    // ✅ SORT BY MATCH SCORE - HIGHEST TO LOWEST (CRITICAL)
    const sorted = withScore.sort((a, b) => b.matchScore - a.matchScore);

    // Mark top 80% as priority
    const priorityCutoff = Math.ceil(sorted.length * 0.8);
    const prioritized = sorted.map((item, index) => ({
      ...item,
      isPriority: index < priorityCutoff,
    }));

    // ============================================================================
    // PAGINATION
    // ============================================================================
    
    const startIndex = (+page - 1) * +limit;
    const endIndex = +page * +limit;
    const paginated = prioritized.slice(startIndex, endIndex);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Properties matched successfully",
      data: paginated,
      pagination: {
        total: prioritized.length,
        totalPages: Math.ceil(prioritized.length / +limit),
        page: +page,
        limit: +limit,
      },
      matchingCriteria: {
        mustMatch: {
          propertyType: expectedBriefType,
          state: preference.location.state,
          lgas: preference.location.localGovernmentAreas,
          priceRange: {
            min: preference.budget?.minPrice || "No minimum",
            max: preference.budget?.maxPrice || "No maximum",
          },
        },
        optional: {
          areas: preference.location.lgasWithAreas,
          bedrooms: preference.propertyDetails?.minBedrooms || preference.bookingDetails?.minBedrooms,
          bathrooms: preference.propertyDetails?.minBathrooms || preference.bookingDetails?.minBathrooms,
          buildingType: preference.propertyDetails?.buildingType || preference.bookingDetails?.buildingType,
          condition: preference.propertyDetails?.propertyCondition || preference.bookingDetails?.propertyCondition,
          features: preference.features?.baseFeatures,
        },
        scoreRange: {
          minimum: 50,
          maximum: 100,
          description: "All properties meet must-match criteria (50 base points). Bonus points (0-50) awarded for optional criteria. Results sorted by score (highest first).",
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * ============================================================================
 * DETAILED SCORING ALGORITHM
 * ============================================================================
 * 
 * All properties here have already passed MUST MATCH criteria:
 * ✅ Property Type matches preference type
 * ✅ Location State matches
 * ✅ Location LGA matches
 * ✅ Price is within budget range
 * 
 * BASE SCORE: 50 points (automatic for passing must-match requirements)
 * 
 * BONUS POINTS (0-50 total maximum):
 * 
 * Location Area Match: 0-10 points
 *   - 10 points: Property is in a preferred area OR no area preference specified
 *   - 0 points: Property not in preferred area (but still valid since LGA matched)
 * 
 * Bedroom Match: 0-10 points
 *   - 10 points: Exact match OR no bedroom preference
 *   - 8 points: 1-2 extra bedrooms
 *   - 5 points: More than 2 extra bedrooms
 *   - 0 points: Below minimum requirement
 * 
 * Bathroom Match: 0-10 points
 *   - 10 points: Exact match OR no bathroom preference
 *   - 8 points: 1 extra bathroom
 *   - 5 points: More than 1 extra bathroom
 *   - 0 points: Below minimum requirement
 * 
 * Building Type: 0-5 points
 *   - 5 points: Matches preference OR no preference specified
 *   - 0 points: Doesn't match preference
 * 
 * Condition: 0-5 points
 *   - 5 points: Matches preference OR no preference specified
 *   - 0 points: Doesn't match preference
 * 
 * Features: 0-10 points
 *   - Proportional to percentage of preferred features matched
 *   - 10 points if no feature preference
 * 
 * Type-Specific Bonuses:
 * - Shortlet: 0-15 points (guest capacity, house rules, availability)
 * - Joint Venture: 0-15 points (land size, document compliance)
 * 
 * FINAL SCORE: 50-100 (capped at 100)
 * Results are sorted by score in descending order (highest match first)
 * ============================================================================
 */
function calculateDetailedMatchScore(property: any, preference: any): number {
  let score = 50; // Base score for passing must-match requirements

  // ============================================================================
  // OPTIONAL CRITERIA - BONUS POINTS
  // ============================================================================

  // ✅ 1. LOCATION AREA BONUS (0-10 points)
  // State and LGA already matched at DB level (must-match)
  // Award bonus if property is in a preferred area within the LGA
  let locationScore = 0;
  
  if (preference.location?.lgasWithAreas?.length) {
    const allPreferredAreas = preference.location.lgasWithAreas.flatMap(
      (lga: any) => lga.areas || []
    );
    
    if (allPreferredAreas.length > 0) {
      const propertyArea = property.location?.area;
      if (propertyArea && allPreferredAreas.includes(propertyArea)) {
        locationScore = 10; // Property in preferred area - full bonus!
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
      const excess = propertyBeds - requiredBeds;
      if (excess === 0) {
        score += 10; // Exact match - perfect!
      } else if (excess <= 2) {
        score += 8; // Close match (1-2 extra bedrooms)
      } else {
        score += 5; // Has more than needed
      }
    }
    // If below requirement, no bonus points (0)
  } else {
    score += 10; // No bedroom preference specified - full bonus
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
        score += 10; // Exact match - perfect!
      } else if (excess <= 1) {
        score += 8; // Close match (1 extra)
      } else {
        score += 5; // Has more than needed
      }
    }
    // If below requirement, no bonus points (0)
  } else {
    score += 10; // No bathroom preference - full bonus
  }

  // ✅ 4. BUILDING TYPE BONUS (0-5 points)
  const preferredBuildingType =
    preference.propertyDetails?.buildingType ||
    preference.bookingDetails?.buildingType;

  if (preferredBuildingType) {
    if (property.typeOfBuilding === preferredBuildingType) {
      score += 5; // Matches preference
    }
    // No match = 0 bonus
  } else {
    score += 5; // No preference - full bonus
  }

  // ✅ 5. CONDITION BONUS (0-5 points)
  const preferredCondition =
    preference.propertyDetails?.propertyCondition ||
    preference.bookingDetails?.propertyCondition;

  if (preferredCondition) {
    if (property.propertyCondition === preferredCondition) {
      score += 5; // Matches preference
    }
    // No match = 0 bonus
  } else {
    score += 5; // No preference - full bonus
  }

  // ✅ 6. FEATURES MATCH (0-10 points)
  if (preference.features?.baseFeatures?.length && property.features?.length) {
    const matchedFeatures = preference.features.baseFeatures.filter((f: string) =>
      property.features.includes(f)
    );
    const matchRatio = matchedFeatures.length / preference.features.baseFeatures.length;
    
    // Proportional scoring based on percentage match
    score += Math.round(matchRatio * 10);
  } else if (!preference.features?.baseFeatures?.length) {
    score += 10; // No feature preference - full bonus
  }
  // If preference has features but property has none = 0 bonus

  // ✅ 7. SHORTLET-SPECIFIC BONUSES (0-15 points)
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
      // Below capacity = 0 bonus
    } else {
      shortletBonus += 8; // No guest preference - full bonus
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
        shortletBonus += 7; // No special rules required - full bonus
      }
    } else {
      shortletBonus += 7; // No house rules preference - full bonus
    }

    score += shortletBonus;
  }

  // ✅ 8. JOINT VENTURE BONUSES (0-15 points)
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
        jvBonus += 8; // Within desired range - full bonus
      }
      // Outside range = 0 bonus
    } else {
      jvBonus += 8; // No land size preference - full bonus
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

      // Proportional scoring based on document match percentage
      jvBonus += Math.round(docRatio * 7);
    } else {
      jvBonus += 7; // No document requirements - full bonus
    }

    score += jvBonus;
  }

  // ============================================================================
  // FINAL SCORE CALCULATION
  // ============================================================================
  
  // Cap at 100 (maximum possible score)
  const finalScore = Math.min(score, 100);
  
  return Math.round(finalScore);
}