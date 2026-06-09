import { DB } from "../controllers";
import { Types } from "mongoose";
import { calculateDetailedMatchScore } from "../controllers/Admin/preference/findMatchProerty";
import { persistMatchedPreferenceProperties } from "./matchedPreferencePersistence.service";
import sendEmail from "../common/send.email";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";
import { noMatchesPreferenceFeedbackMail } from "../common/emailTemplates/preference";
import { preferencePhysicalTypeMatches } from "../utils/preferencePhysicalTypeMatch";
import { isLikelyE164CapableLocalPhone, runWhatsapp } from "./whatsappClient.service";
import { getAgentAccessGate } from "./agentPublisherEligibility.service";
import { dealSiteBaseUrlFromPublicSlug } from "../utils/matchedPropertiesDealSiteUrl";
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

  return scored
    .filter((x) => x.matchScore >= MIN_MATCH_SCORE)
    .slice(0, MAX_AUTO_MATCHED_PROPERTIES)
    .map((x) => new Types.ObjectId(x.property._id));
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

async function resolvePreferenceRecipientEmail(preference: any): Promise<string | undefined> {
  let email: string | undefined;

  if (preference.buyer) {
    const buyer = await DB.Models.Buyer.findById(preference.buyer).select("email").lean();
    email = (buyer as any)?.email;
  }

  if (!email) {
    email = (preference.contactInfo as any)?.email;
  }

  const normalized = String(email || "").trim();
  if (!normalized || normalized === "unknown@example.com") {
    return undefined;
  }

  return normalized;
}

async function resolveSubmitPreferenceUrl(preference: any): Promise<string | undefined> {
  const receiverMode = preference?.receiverMode;
  if (receiverMode?.type === "dealSite" && receiverMode.dealSiteID) {
    const dealSite = await DB.Models.DealSite.findById(receiverMode.dealSiteID)
      .select("publicSlug")
      .lean();
    const slug = String((dealSite as any)?.publicSlug || "").trim();
    if (slug) {
      const base = dealSiteBaseUrlFromPublicSlug(slug).replace(/\/$/, "");
      return `${base}/submit-preference`;
    }
  }

  const clientBase = (process.env.CLIENT_LINK || process.env.APP_URL || "").replace(/\/$/, "");
  return clientBase ? `${clientBase}/preferences/submit` : undefined;
}

async function sendPreferenceNoMatchesEmail(preferenceId: string): Promise<void> {
  const preference = await DB.Models.Preference.findById(preferenceId).lean();
  if (!preference) return;

  const email = await resolvePreferenceRecipientEmail(preference);
  if (!email) {
    console.warn(
      "[autoPairPreference] No-match email skipped — no recipient email for preference",
      preferenceId,
    );
    return;
  }

  const buyerName =
    (preference.contactInfo as any)?.fullName ||
    (preference.contactInfo as any)?.contactPerson ||
    "there";

  const clientBase = (process.env.CLIENT_LINK || process.env.APP_URL || "")
    .replace(/\/$/, "");
  const submitPreferenceUrl = await resolveSubmitPreferenceUrl(preference);

  const inner = noMatchesPreferenceFeedbackMail({
    buyerName,
    submitPreferenceUrl,
  });
  const html = generalEmailLayout(inner);
  const text =
    `Hi ${buyerName}, we did not find matching approved listings for your preference yet. ` +
    `You can submit an updated preference or wait for new listings—we will email you when matches are found.`;

  await sendEmail({
    to: email,
    subject: "No matching listings yet – Khabi-Teq",
    html,
    text,
  });

  let phone: string | undefined = (preference.contactInfo as any)?.phoneNumber;
  if (!phone && preference.buyer) {
    const b = await DB.Models.Buyer.findById(preference.buyer)
      .select("phoneNumber whatsAppNumber")
      .lean();
    phone = (b as any)?.whatsAppNumber || (b as any)?.phoneNumber;
  }
  const phoneLine = String(phone || "").replace(/\s/g, "");
  const appLink = clientBase || "Khabi-Teq app or website";

  if (isLikelyE164CapableLocalPhone(phoneLine)) {
    void runWhatsapp("preference_no_match", async (wa) => {
      const r = await wa.sendPreferenceNoMatchesYet({
        user: { name: buyerName, phone: phoneLine, id: String(preference.buyer || "") },
        appLink,
      });
      if (!r.success) {
        console.warn("[autoPairPreference] no-match WhatsApp failed:", r.error);
      }
    });
  }
}

/**
 * Find approved briefs, rank by optional criteria, persist MatchedPreferenceProperty (+ notify).
 * If there are no matches (including preferences missing state/LGA for search), sends the no-match
 * feedback email so submit flows consistently deliver a second email alongside the submission ack.
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

  const ids = await computeMatchingPropertyIdsForPreference(preference);

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
      await sendPreferenceNoMatchesEmail(preferenceId);
    } catch (e) {
      console.warn("[autoPairPreferenceById] No-match email failed:", e);
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
      });
      if (result?.matchedRecord) paired += 1;
    } catch (e) {
      console.warn("[autoPairPreferencesForNewProperty] persist failed for preference", pref._id, e);
    }
  }

  return { pairedPreferences: paired };
}
