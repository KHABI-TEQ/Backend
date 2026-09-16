import { DB } from "../controllers";
import { Types } from "mongoose";
import { calculateDetailedMatchScore } from "../controllers/Admin/preference/findMatchProerty";
import { persistMatchedPreferenceProperties } from "./matchedPreferencePersistence.service";
import { preferencePhysicalTypeMatches } from "../utils/preferencePhysicalTypeMatch";
import { getAgentAccessGate } from "./agentPublisherEligibility.service";
import { notifyPreferenceNoMatches } from "./preferenceUnmatchedNotify.service";
import {
  dedupeScoredPropertiesByPhysicalIdentity,
  toObjectIds,
} from "../utils/propertyPhysicalFingerprint";
import { resolveLeanRefToObjectId } from "../utils/mongooseId";

const PREFERENCE_TO_BRIEF_TYPE: Record<string, string> = {
  buy: "sell",
  "joint-venture": "jv",
  rent: "rent",
  shortlet: "shortlet",
  "off-plan": "off-plan",
};

/** Map property brief `propertyType` → buyer `preferenceType`. */
const BRIEF_TO_PREFERENCE_TYPE: Record<string, string> = {
  sell: "buy",
  jv: "joint-venture",
  rent: "rent",
  shortlet: "shortlet",
  "off-plan": "off-plan",
};

/** Listings in these workflow states are not offered for preference matching. */
const PROPERTY_STATUSES_EXCLUDED_FROM_MATCHING = [
  "sold",
  "sold_leased_registered",
  "withdrawn",
  "cancelled",
  "expired",
  "rejected",
  "deleted",
  "unavailable",
  "failed",
  "never_listed",
  "booked",
  "flagged",
  "hold",
  "temporarily_off_market",
] as const;

const MAX_AUTO_MATCHED_PROPERTIES = 50;
const MIN_MATCH_SCORE = 50;

function normLoc(s: string | undefined | null): string {
  return String(s ?? "").trim().toLowerCase();
}

/**
 * True when a listing is approved, available, not sold/withdrawn, has price and core location.
 */
export function isPropertyListedAndMatchable(property: any): boolean {
  if (!property) return false;
  if (property.isDeleted === true) return false;
  if (property.isRejected === true) return false;
  if (property.isApproved !== true) return false;
  if (property.isAvailable === false) return false;
  const st = property.status;
  if (st != null && (PROPERTY_STATUSES_EXCLUDED_FROM_MATCHING as readonly string[]).includes(st)) {
    return false;
  }
  const pr = property.price;
  if (pr == null || !Number.isFinite(Number(pr))) return false;
  if (!property.location?.state || !property.location?.localGovernment) return false;
  return true;
}

export function propertyPriceMatchesPreferenceRelaxed(propertyPrice: number, preference: any): boolean {
  const minP = preference.budget?.minPrice;
  const maxP = preference.budget?.maxPrice;
  if (minP == null && maxP == null) return true;
  const p = Number(propertyPrice);
  if (!Number.isFinite(p)) return false;
  if (minP != null && Number.isFinite(Number(minP)) && p < Number(minP) * 0.9) return false;
  if (maxP != null && Number.isFinite(Number(maxP)) && p > Number(maxP) * 1.1) return false;
  return true;
}

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
 * When the buyer selected estates for the property's area, the listing must match
 * via location.estate, exact area name, or street/area text containing the estate.
 */
function propertyMatchesSubmittedEstates(preference: any, property: any): boolean {
  const propLga = property.location?.localGovernment;
  const propArea = property.location?.area;
  const lgasWith = preference.location?.lgasWithAreas as
    | {
        lgaName?: string;
        areasWithEstates?: { areaName?: string; estates?: string[] }[];
      }[]
    | undefined;

  if (!lgasWith?.length) return true;

  const entry = lgasWith.find((x) => normLoc(x.lgaName) === normLoc(propLga));
  if (!entry?.areasWithEstates?.length) return true;

  const areaRow = entry.areasWithEstates.find(
    (r) => normLoc(r.areaName) === normLoc(propArea),
  );
  // Estates selected for other areas only — don't hard-block this area.
  if (!areaRow) return true;

  const estates = (areaRow.estates || []).map(normLoc).filter(Boolean);
  if (!estates.length) return true;

  const propEstate = normLoc(property.location?.estate);
  if (propEstate && estates.includes(propEstate)) return true;

  const propAreaN = normLoc(propArea);
  if (propAreaN && estates.includes(propAreaN)) return true;

  const haystack = `${propEstate} ${propAreaN} ${normLoc(property.location?.streetAddress)}`;
  return estates.some((e) => e.length >= 3 && haystack.includes(e));
}

function preferenceHasMinimumLocationForPairing(preference: any): boolean {
  const expectedBriefType = PREFERENCE_TO_BRIEF_TYPE[preference.preferenceType];
  if (!expectedBriefType) return false;
  if (!preference.location?.state) return false;
  if (!preference.location?.localGovernmentAreas?.length) return false;
  return true;
}

/**
 * DealSite preferences: only listings owned by or marketed through the practitioner.
 * General (main website) preferences: no extra scope — scan all eligible listings.
 */
async function buildPropertyScopeForPreference(
  preference: any,
): Promise<Record<string, unknown> | null> {
  const receiverMode = preference?.receiverMode;
  if (receiverMode?.type !== "dealSite" || !receiverMode.dealSiteID) {
    return null;
  }

  const dealSite = await DB.Models.DealSite.findById(receiverMode.dealSiteID)
    .select("createdBy")
    .lean();
  const creatorId = resolveLeanRefToObjectId(dealSite?.createdBy);
  if (!creatorId) {
    return { _id: { $in: [] } };
  }

  return {
    $or: [
      { owner: creatorId },
      { marketedByAgentIds: creatorId },
      { marketedByAgentId: creatorId },
    ],
  };
}

async function mergePreferencePropertyQuery(
  preference: any,
  baseQuery: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const scope = await buildPropertyScopeForPreference(preference);
  if (!scope) return baseQuery;
  return { $and: [baseQuery, scope] };
}

async function propertyBelongsToDealSitePractitioner(
  property: any,
  dealSiteId: unknown,
): Promise<boolean> {
  const dealSite = await DB.Models.DealSite.findById(dealSiteId).select("createdBy").lean();
  const creatorId = resolveLeanRefToObjectId(dealSite?.createdBy);
  if (!creatorId) return false;

  const ownerId = resolveLeanRefToObjectId(property?.owner);
  if (ownerId?.equals(creatorId)) return true;

  const marketedIds: unknown[] = Array.isArray(property?.marketedByAgentIds)
    ? property.marketedByAgentIds
    : [];
  if (property?.marketedByAgentId != null) {
    marketedIds.push(property.marketedByAgentId);
  }

  return marketedIds.some((id) => {
    const oid = resolveLeanRefToObjectId(id);
    return oid?.equals(creatorId) ?? false;
  });
}

async function buildAgentOwnerEligibilityMap(
  properties: Array<{ owner?: unknown }>,
): Promise<Map<string, boolean>> {
  const ownerIds = [
    ...new Set(
      properties
        .map((p) => (p.owner ? String(p.owner) : ""))
        .filter((id) => id.length > 0),
    ),
  ];

  if (ownerIds.length === 0) {
    return new Map();
  }

  const owners = await DB.Models.User.find({ _id: { $in: ownerIds } })
    .select("_id userType")
    .lean();

  const agentOwnerIds = owners
    .filter((owner) => owner.userType === "Agent")
    .map((owner) => String(owner._id));

  const eligibility = new Map<string, boolean>();
  await Promise.all(
    agentOwnerIds.map(async (ownerId) => {
      const gate = await getAgentAccessGate(ownerId);
      eligibility.set(ownerId, gate.ok);
    }),
  );

  return eligibility;
}

async function scoreAndFilterPropertyDocs(
  preference: any,
  baseQuery: Record<string, unknown>,
): Promise<Types.ObjectId[]> {
  const rawMatches = await DB.Models.Property.find(baseQuery).lean();
  const agentEligibility = await buildAgentOwnerEligibilityMap(rawMatches);

  const eligible = rawMatches.filter((p: any) => {
    if (!isPropertyListedAndMatchable(p)) return false;
    if (!preferencePhysicalTypeMatches(preference, p)) return false;
    if (!propertyMatchesSubmittedAreas(preference, p)) return false;
    if (!propertyMatchesSubmittedEstates(preference, p)) return false;
    const pr = p.price;
    if (pr == null || !Number.isFinite(Number(pr))) return false;
    if (!propertyPriceMatchesPreferenceRelaxed(Number(pr), preference)) return false;
    const ownerId = p.owner ? String(p.owner) : "";
    if (ownerId && agentEligibility.get(ownerId) === false) return false;
    return true;
  });

  const scored = eligible.map((property: any) => ({
    property,
    matchScore: calculateDetailedMatchScore(property, preference),
  }));

  scored.sort((a, b) => b.matchScore - a.matchScore);

  const aboveFloor = scored.filter((x) => x.matchScore >= MIN_MATCH_SCORE);
  const deduped = dedupeScoredPropertiesByPhysicalIdentity(aboveFloor);

  return toObjectIds(deduped.slice(0, MAX_AUTO_MATCHED_PROPERTIES));
}

/**
 * ObjectIds of properties that match the preference (same rules as automatic pairing after submit).
 */
export async function computeMatchingPropertyIdsForPreference(preference: any): Promise<Types.ObjectId[]> {
  if (!preferenceHasMinimumLocationForPairing(preference)) return [];

  const expectedBriefType = PREFERENCE_TO_BRIEF_TYPE[preference.preferenceType];

  const baseQuery: Record<string, unknown> = {
    isDeleted: { $ne: true },
    isRejected: { $ne: true },
    isApproved: true,
    isAvailable: { $ne: false },
    status: { $nin: [...PROPERTY_STATUSES_EXCLUDED_FROM_MATCHING] },
    propertyType: expectedBriefType,
    "location.state": preference.location.state,
    "location.localGovernment": { $in: preference.location.localGovernmentAreas },
  };

  const priceQ = buildRelaxedPriceQuery(preference);
  if (priceQ) (baseQuery as any).price = priceQ;

  const query = await mergePreferencePropertyQuery(preference, baseQuery);
  return scoreAndFilterPropertyDocs(preference, query);
}

/**
 * Preference + single property satisfy the same scoring/area/price rules as batch pairing.
 */
export async function preferenceMatchesPropertyForReversePair(
  preference: any,
  property: any,
): Promise<boolean> {
  if (!preferenceHasMinimumLocationForPairing(preference)) return false;
  const expectedBriefType = PREFERENCE_TO_BRIEF_TYPE[preference.preferenceType];
  if (!expectedBriefType || property.propertyType !== expectedBriefType) return false;
  if (property.location?.state !== preference.location.state) return false;
  const lgas = preference.location.localGovernmentAreas || [];
  if (!lgas.includes(property.location?.localGovernment)) return false;
  if (!isPropertyListedAndMatchable(property)) return false;
  if (!preferencePhysicalTypeMatches(preference, property)) return false;
  if (!propertyMatchesSubmittedAreas(preference, property)) return false;
  if (!propertyPriceMatchesPreferenceRelaxed(Number(property.price), preference)) return false;

  const receiverMode = preference?.receiverMode;
  if (receiverMode?.type === "dealSite" && receiverMode.dealSiteID) {
    const inScope = await propertyBelongsToDealSitePractitioner(
      property,
      receiverMode.dealSiteID,
    );
    if (!inScope) return false;
  }

  const ownerId = property.owner ? String(property.owner) : "";
  if (ownerId) {
    const owner = await DB.Models.User.findById(ownerId).select("userType").lean();
    if (owner?.userType === "Agent") {
      const gate = await getAgentAccessGate(ownerId);
      if (gate.ok === false) return false;
    }
  }
  const score = calculateDetailedMatchScore(property, preference);
  return score >= MIN_MATCH_SCORE;
}

/**
 * Find approved briefs, rank by optional criteria, persist MatchedPreferenceProperty (+ notify).
 * If there are no matches (including preferences missing state/LGA for search), sends the no-match
 * email + in-app notification so submit flows consistently follow the submission ack.
 */
export async function autoPairPreferenceById(
  preferenceId: string,
  options?: {
    sendMatchEmail?: boolean;
    sendNoMatchEmail?: boolean;
    /** Base URL for the “view matches” link in the buyer email (agent DealSite). */
    matchEmailBaseUrlOverride?: string;
    /** Optional note stored on MatchedPreferenceProperty (e.g. agent-initiated). */
    matchNotes?: string;
  },
): Promise<{ matchedCount: number }> {
  const sendMatchEmail = options?.sendMatchEmail !== false;
  const sendNoMatchEmail = options?.sendNoMatchEmail !== false;

  const preference = await DB.Models.Preference.findById(preferenceId).lean();
  if (!preference) return { matchedCount: 0 };

  let ids = await computeMatchingPropertyIdsForPreference(preference);
  const coded = String((preference as { propertyCode?: string }).propertyCode || "").trim();
  if (coded) {
    const { lookupPropertyByCode } = await import("./propertyCode.service");
    const found = await lookupPropertyByCode(coded);
    if (found?.property?.id) {
      const priorityId = found.property.id;
      ids = [
        new Types.ObjectId(priorityId),
        ...ids.filter((id) => String(id) !== priorityId),
      ];
    }
  }

  if (ids.length > 0) {
    await persistMatchedPreferenceProperties({
      preferenceId,
      matchedPropertyIds: ids,
      notes: options?.matchNotes ?? "Automatically matched from your preference (LGA, submitted areas, ±10% price band, and fit score).",
      sendMatchEmail,
      matchEmailBaseUrlOverride: options?.matchEmailBaseUrlOverride,
    });
    return { matchedCount: ids.length };
  }

  if (sendNoMatchEmail) {
    try {
      await notifyPreferenceNoMatches(preferenceId);
    } catch (e) {
      console.warn("[autoPairPreferenceById] No-match notify failed:", e);
    }
  }

  return { matchedCount: 0 };
}

/**
 * When a new listing is approved and matchable, attach it to every open preference that fits (and notify buyers for new links only).
 */
export async function autoPairPreferencesForNewProperty(propertyId: string): Promise<{ pairedPreferences: number }> {
  const property = await DB.Models.Property.findById(propertyId).lean();
  if (!property || !isPropertyListedAndMatchable(property)) {
    return { pairedPreferences: 0 };
  }

  const preferenceType = BRIEF_TO_PREFERENCE_TYPE[(property as any).propertyType];
  if (!preferenceType) return { pairedPreferences: 0 };

  const prefs = await DB.Models.Preference.find({
    status: { $in: ["approved", "matched"] },
    preferenceType,
    "location.state": (property as any).location.state,
    "location.localGovernmentAreas": (property as any).location.localGovernment,
  }).lean();

  let paired = 0;
  const propOid = new Types.ObjectId((property as any)._id);

  for (const pref of prefs) {
    if (!(await preferenceMatchesPropertyForReversePair(pref, property))) continue;

    const existingMatch = await DB.Models.MatchedPreferenceProperty.findOne({
      preference: pref._id,
    })
      .select("matchedProperties")
      .lean();
    if (
      existingMatch?.matchedProperties?.some((id: any) => new Types.ObjectId(id).equals(propOid))
    ) {
      continue;
    }

    try {
      const result = await persistMatchedPreferenceProperties({
        preferenceId: pref._id.toString(),
        matchedPropertyIds: [propOid],
        notes: "Automatically matched when a new listing met your preference.",
        sendMatchEmail: true,
        forceSendMatchEmail: false,
        notifyChannels: "all",
      });
      if (result?.matchedRecord) paired += 1;
    } catch (e) {
      console.warn("[autoPairPreferencesForNewProperty] persist failed for preference", pref._id, e);
    }
  }

  return { pairedPreferences: paired };
}
