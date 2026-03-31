import { DB } from "../controllers";

/**
 * Mapping: preference type → property propertyType (same as admin findMatchProerty).
 * Preference: "buy" | "joint-venture" | "rent" | "shortlet"
 * Property: "sell" | "jv" | "rent" | "shortlet"
 */
const PREFERENCE_TO_PROPERTY_TYPE: Record<string, string> = {
  buy: "sell",
  "joint-venture": "jv",
  rent: "rent",
  shortlet: "shortlet",
};

/**
 * Builds the same "must match" query used for preference–property matching:
 * property type, location (state; LGA when provided), and budget range.
 * Used after POST /preferences/submit to match the new preference against
 * existing briefs (FRONTEND_API_GUIDE §10.4). Does not persist matches;
 * agents see approved preferences and use admin/frontend flows to submit matches.
 */
function buildMatchQuery(preference: {
  preferenceType?: string;
  location?: { state?: string; localGovernmentAreas?: string[] };
  budget?: { minPrice?: number; maxPrice?: number };
}): Record<string, unknown> | null {
  const query: Record<string, unknown> = {
    isDeleted: false,
    isRejected: false,
    isApproved: true,
  };

  const expectedType = preference.preferenceType
    ? PREFERENCE_TO_PROPERTY_TYPE[preference.preferenceType]
    : null;
  if (!expectedType) return null;
  (query as any).propertyType = expectedType;

  if (preference.location?.state) {
    (query as any)["location.state"] = preference.location.state;
    if (
      preference.location.localGovernmentAreas &&
      preference.location.localGovernmentAreas.length > 0
    ) {
      (query as any)["location.localGovernment"] = {
        $in: preference.location.localGovernmentAreas,
      };
    }
  } else {
    return null;
  }

  if (
    preference.budget?.minPrice != null ||
    preference.budget?.maxPrice != null
  ) {
    const priceCond: Record<string, number> = {};
    if (preference.budget.minPrice != null) priceCond.$gte = preference.budget.minPrice;
    if (preference.budget.maxPrice != null) priceCond.$lte = preference.budget.maxPrice;
    (query as any).price = priceCond;
  }

  return query;
}

/**
 * Counts briefs that meet strict type/location/budget (legacy helper).
 * For persisted pairing + buyer email, use `autoPairPreferenceById` in autoPreferencePairing.service.
 */
export async function matchPreferenceAgainstProperties(preference: {
  preferenceType?: string;
  location?: { state?: string; localGovernmentAreas?: string[] };
  budget?: { minPrice?: number; maxPrice?: number };
}): Promise<number> {
  const query = buildMatchQuery(preference);
  if (!query) return 0;
  return DB.Models.Property.countDocuments(query);
}
