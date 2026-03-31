import { DB } from "../controllers";
import { Types } from "mongoose";
import { calculateDetailedMatchScore } from "../controllers/Admin/preference/findMatchProerty";
import { persistMatchedPreferenceProperties } from "./matchedPreferencePersistence.service";

const PREFERENCE_TO_BRIEF_TYPE: Record<string, string> = {
  buy: "sell",
  "joint-venture": "jv",
  rent: "rent",
  shortlet: "shortlet",
};

/** Cap automatic matches per preference to keep payloads and emails reasonable. */
const MAX_AUTO_MATCHED_PROPERTIES = 50;

function normLoc(s: string | undefined | null): string {
  return String(s ?? "").trim().toLowerCase();
}

/**
 * Listing price must fall within preference budget extended by 10% below min and 10% above max.
 */
function buildRelaxedPriceQuery(preference: {
  budget?: { minPrice?: number; maxPrice?: number };
}): Record<string, number> | null {
  const minP = preference.budget?.minPrice;
  const maxP = preference.budget?.maxPrice;
  if (minP == null && maxP == null) return null;
  const price: Record<string, number> = {};
  if (minP != null && Number.isFinite(Number(minP))) {
    price.$gte = Number(minP) * 0.9;
  }
  if (maxP != null && Number.isFinite(Number(maxP))) {
    price.$lte = Number(maxP) * 1.1;
  }
  return Object.keys(price).length ? price : null;
}

/**
 * When the client submitted areas for an LGA, the property must be in one of those areas.
 * If there is no area list for that property's LGA, the LGA match from the DB query is enough.
 */
function propertyMatchesSubmittedAreas(preference: any, property: any): boolean {
  const propLga = property.location?.localGovernment;
  const propArea = property.location?.area;
  const lgasWith = preference.location?.lgasWithAreas as
    | { lgaName?: string; areas?: string[] }[]
    | undefined;

  if (!lgasWith?.length) return true;

  const entry = lgasWith.find((x) => normLoc(x.lgaName) === normLoc(propLga));
  if (!entry) return true;

  const areas = (entry.areas || []).filter((a) => normLoc(a));
  if (areas.length === 0) return true;

  if (!propArea || !normLoc(propArea)) return false;

  const nPropArea = normLoc(propArea);
  return areas.some((a) => normLoc(a) === nPropArea);
}

/**
 * Find approved briefs, rank by the same optional criteria as admin matching, persist MatchedPreferenceProperty (+ notify).
 */
export async function autoPairPreferenceById(
  preferenceId: string,
  options?: { sendMatchEmail?: boolean },
): Promise<{ matchedCount: number }> {
  const sendMatchEmail = options?.sendMatchEmail !== false;

  const preference = await DB.Models.Preference.findById(preferenceId).lean();
  if (!preference) return { matchedCount: 0 };

  const expectedBriefType = PREFERENCE_TO_BRIEF_TYPE[preference.preferenceType];
  if (!expectedBriefType) return { matchedCount: 0 };

  if (!preference.location?.state) return { matchedCount: 0 };
  if (!preference.location?.localGovernmentAreas?.length) return { matchedCount: 0 };

  const baseQuery: Record<string, unknown> = {
    isDeleted: false,
    isRejected: false,
    isApproved: true,
    propertyType: expectedBriefType,
    "location.state": preference.location.state,
    "location.localGovernment": { $in: preference.location.localGovernmentAreas },
  };

  const priceQ = buildRelaxedPriceQuery(preference as any);
  if (priceQ) (baseQuery as any).price = priceQ;

  const rawMatches = await DB.Models.Property.find(baseQuery).lean();

  const eligible = rawMatches.filter((p: any) => {
    if (!propertyMatchesSubmittedAreas(preference, p)) return false;
    const pr = p.price;
    if (pr == null || !Number.isFinite(Number(pr))) return false;
    return true;
  });

  const scored = eligible.map((property: any) => ({
    property,
    matchScore: calculateDetailedMatchScore(property, preference),
  }));

  scored.sort((a, b) => b.matchScore - a.matchScore);

  const MIN_SCORE = 50;
  const ids = scored
    .filter((x) => x.matchScore >= MIN_SCORE)
    .slice(0, MAX_AUTO_MATCHED_PROPERTIES)
    .map((x) => new Types.ObjectId(x.property._id));

  if (!ids.length) return { matchedCount: 0 };

  await persistMatchedPreferenceProperties({
    preferenceId,
    matchedPropertyIds: ids,
    notes: "Automatically matched from your preference (LGA, submitted areas, ±10% price band, and fit score).",
    sendMatchEmail,
  });

  return { matchedCount: ids.length };
}
