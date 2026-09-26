import crypto from "crypto";
import { Types } from "mongoose";
import { DB } from "../controllers";
import sendEmail from "../common/send.email";
import {
  matchedPropertiesMail,
  buildPreferenceLandSizeEmailLine,
} from "../common/emailTemplates/preference";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";
import { resolveMatchedPropertiesEmailBaseUrl, dealSitePublicSlugForProperty } from "../utils/matchedPropertiesDealSiteUrl";
import { calculateDetailedMatchScore } from "../controllers/Admin/preference/findMatchProerty";
import { getPropertyTitleFromLocation } from "../utils/helper";
import {
  clientAbsoluteUrl,
  insuredMatchPath,
  isDealSitePreference,
  isMainSiteWebsitePreference,
  isPreferenceInsuredSearch,
  publicFrontendPropertyPath,
} from "../utils/seekerJourney";
import { isLikelyE164CapableLocalPhone, runWhatsapp } from "./whatsappClient.service";
import { getBuyerConfirmationApiPath } from "./buyerConfirmationToken.service";
import {
  createBuyerInboxNotification,
  pushToBuyerDevices,
} from "./buyerNotification.service";

export const MATCH_BATCH_SIZE = 5;

/** How match alerts are delivered. */
export type MatchNotifyChannels = "submittedVia" | "all";

export function generateMatchBatchToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function tokensMatch(stored?: string | null, provided?: string | null): boolean {
  const a = String(stored || "");
  const b = String(provided || "");
  if (!a || !b || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/** Legacy records without revealedCount were already fully emailed — treat as fully revealed. */
export function effectiveRevealedCount(record: {
  revealedCount?: number | null;
  matchedProperties?: unknown[];
}): number {
  const total = Array.isArray(record.matchedProperties)
    ? record.matchedProperties.length
    : 0;
  if (record.revealedCount == null) return total;
  const n = Number(record.revealedCount);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, total);
}

export function matchBatchSummary(record: {
  revealedCount?: number | null;
  matchedProperties?: unknown[];
  batchAccessToken?: string;
}) {
  const total = Array.isArray(record.matchedProperties)
    ? record.matchedProperties.length
    : 0;
  const revealedCount = effectiveRevealedCount(record);
  const remaining = Math.max(0, total - revealedCount);
  return {
    revealedCount,
    total,
    remaining,
    hasMore: remaining > 0,
    nextBatchSize: Math.min(MATCH_BATCH_SIZE, remaining),
    batchAccessToken: record.batchAccessToken || "",
  };
}

function apiBase(): string {
  return getBuyerConfirmationApiPath().replace(/\/$/, "");
}

function preferenceSummaryFrom(preference: any) {
  const locationString =
    preference.location?.customLocation ||
    `${preference.location?.state || ""}${
      preference.location?.localGovernmentAreas?.length
        ? `, ${preference.location.localGovernmentAreas.join(", ")}`
        : ""
    }`;
  const { minPrice, maxPrice, currency } = preference.budget || {};
  const priceRange = `${minPrice?.toLocaleString() || "N/A"} - ${maxPrice?.toLocaleString() || "N/A"} ${currency || "NGN"}`;
  let summaryData: any = {};
  switch (preference.preferenceType) {
    case "buy":
    case "rent":
    case "off-plan":
      summaryData = preference.propertyDetails || {};
      break;
    case "joint-venture":
      summaryData = preference.developmentDetails || {};
      break;
    case "shortlet":
      summaryData = preference.bookingDetails || {};
      break;
  }
  return {
    propertyType: summaryData.propertyType || "N/A",
    locationString,
    priceRange,
    usageOption: summaryData.purpose || "N/A",
    propertyFeatures:
      [
        ...(preference.features?.baseFeatures || []),
        ...(preference.features?.premiumFeatures || []),
      ].join(", ") || "Not specified",
    landSize: buildPreferenceLandSizeEmailLine({
      propertyDetails: preference.propertyDetails,
      developmentDetails: preference.developmentDetails,
      bookingDetails: preference.bookingDetails,
    }),
  };
}

async function propertiesForIds(ids: Types.ObjectId[]) {
  if (!ids.length) return [] as any[];
  const docs = await DB.Models.Property.find({ _id: { $in: ids } }).lean();
  const byId = new Map(docs.map((p: any) => [String(p._id), p]));
  return ids.map((id) => byId.get(String(id))).filter(Boolean) as any[];
}

export async function attachPublicSlugToFormattedProperties(
  formatted: any[],
  rawProperties: any[]
): Promise<any[]> {
  const slugById = new Map<string, string>();
  await Promise.all(
    rawProperties.map(async (p) => {
      if (!p?._id) return;
      const slug = await dealSitePublicSlugForProperty(p);
      if (slug) slugById.set(String(p._id), slug);
    })
  );
  return formatted.map((row) => ({
    ...row,
    publicSlug: slugById.get(String(row.id || row._id)) || "",
  }));
}

export async function notifyMatchBatch(params: {
  preference: any;
  matchedRecord: any;
  batchPropertyIds: Types.ObjectId[];
  matchEmailBaseUrlOverride?: string;
  notifyChannels?: MatchNotifyChannels;
}): Promise<void> {
  const {
    preference,
    matchedRecord,
    batchPropertyIds,
    matchEmailBaseUrlOverride,
    notifyChannels = "submittedVia",
  } = params;
  const batch = matchBatchSummary(matchedRecord);
  const batchSize = batchPropertyIds.length;
  if (!batchSize) return;

  const propertiesOrdered = await propertiesForIds(
    (matchedRecord.matchedProperties || []).map((id: Types.ObjectId) => id)
  );
  const trimmedOverride = matchEmailBaseUrlOverride?.replace(/\/$/, "").trim();
  const isDealSite =
    isDealSitePreference(preference) || Boolean(trimmedOverride);
  const insured = isPreferenceInsuredSearch(preference);
  const mainSiteWebsite = !isDealSite && isMainSiteWebsitePreference(preference);

  const matchBaseUrl = trimmedOverride
    ? trimmedOverride
    : isDealSite
      ? await resolveMatchedPropertiesEmailBaseUrl(propertiesOrdered)
      : "";
  const matchLink = isDealSite
    ? `${(matchBaseUrl || (await resolveMatchedPropertiesEmailBaseUrl(propertiesOrdered))).replace(/\/$/, "")}/matched-properties/${matchedRecord._id}/${preference._id}`
    : "";
  const api = apiBase();
  const token = String(matchedRecord.batchAccessToken || "");
  const nextBatchLink =
    isDealSite && batch.hasMore && token
      ? api
        ? `${api}/preferences/matches/${matchedRecord._id}/${preference._id}/next-batch?token=${encodeURIComponent(token)}`
        : `${matchLink}?pullNext=1&token=${encodeURIComponent(token)}`
      : "";

  const buyerId = String(
    preference.buyer?._id || preference.buyer || ""
  );
  const via = String(preference.submittedVia || "website").toLowerCase() === "app"
    ? "app"
    : "website";

  const batchDocs = batchPropertyIds
    .map((id) => propertiesOrdered.find((p: any) => String(p._id) === String(id)))
    .filter(Boolean) as any[];
  const listingLinks = mainSiteWebsite
    ? batchDocs.map((p) => {
        const title =
          getPropertyTitleFromLocation(p.location) || p.propertyType || "Property";
        const loc = p.location
          ? [p.location.area, p.location.localGovernment, p.location.state]
              .filter(Boolean)
              .join(", ")
          : "";
        const path = insured
          ? insuredMatchPath(String(p._id), String(preference._id), String(matchedRecord._id))
          : publicFrontendPropertyPath(p);
        return { title, location: loc, url: clientAbsoluteUrl(path), path };
      })
    : [];
  const firstListing = listingLinks[0];
  const emailMatchLink = firstListing?.url || matchLink || clientAbsoluteUrl("/buyer/searches");

  const title = `${batch.total} match${batch.total === 1 ? "" : "es"} found`;
  const message = batch.hasMore
    ? `${batchSize} ${batchSize === 1 ? "is" : "are"} ready to view (${batch.revealedCount} of ${batch.total}). Open this batch, or request the next ${batch.nextBatchSize}.`
    : `All ${batch.total} match${batch.total === 1 ? "" : "es"} for your preference ${batch.total === 1 ? "is" : "are"} ready to view.`;

  const pushTitle = title;
  const pushBody = message;

  const webActionPath =
    mainSiteWebsite && insured && firstListing
      ? firstListing.path
      : `/matches/${matchedRecord._id}/${preference._id}`;

  const inboxMeta = {
    source: via === "app" ? "system" : "email",
    audience: "buyer" as const,
    screen: "matches",
    matchedId: String(matchedRecord._id),
    preferenceId: String(preference._id),
    propertyId: firstListing ? String(batchDocs[0]?._id || "") : undefined,
    buyerId,
    hasMore: batch.hasMore,
    nextBatchSize: batch.nextBatchSize,
    actionPath: webActionPath,
  };

  const sendInbox = async () => {
    if (!buyerId) return;
    await createBuyerInboxNotification({
      buyerId,
      title,
      message,
      type: "preference",
      meta: { ...inboxMeta, source: "system" },
    });
  };

  const sendMatchEmail = async () => {
    const to =
      String((preference.contactInfo as any)?.email || "").trim() ||
      String((preference.buyer as any)?.email || "").trim();
    if (!to || to === "unknown@example.com") return;
    const mailBody = generalEmailLayout(
      matchedPropertiesMail({
        contactInfo: preference.contactInfo,
        preferenceSummary: preferenceSummaryFrom(preference),
        matchCount: batchSize,
        totalMatchCount: batch.total,
        revealedCount: batch.revealedCount,
        matchLink: emailMatchLink,
        nextBatchLink: nextBatchLink || undefined,
        remainingCount: batch.remaining,
        listingLinks: listingLinks.length ? listingLinks : undefined,
      })
    );
    await sendEmail({
      to,
      subject: `🎯 ${batchSize} Property Match${batchSize > 1 ? "es" : ""} Ready (${batch.revealedCount} of ${batch.total})`,
      html: mailBody,
      text: mailBody,
      skipBuyerInbox: true,
    });
  };

  const sendPushOnly = async () => {
    if (!buyerId) return;
    await pushToBuyerDevices({
      buyerId,
      title: pushTitle,
      body: pushBody,
      type: "preference",
      data: {
        type: "preference",
        screen: "matches",
        matchedId: String(matchedRecord._id),
        preferenceId: String(preference._id),
        buyerId,
        hasMore: batch.hasMore ? "true" : "false",
        actionPath: webActionPath,
      },
    });
  };

  if (mainSiteWebsite) {
    try {
      await sendMatchEmail();
    } catch (e) {
      console.warn("[matchBatch] Match email failed:", e);
    }
    if (insured) {
      try {
        await sendInbox();
      } catch (e) {
        console.warn("[matchBatch] Match in-app notify failed:", e);
      }
    }
  } else if (notifyChannels === "all") {
    try {
      await sendMatchEmail();
    } catch (e) {
      console.warn("[matchBatch] Match email failed:", e);
    }
    try {
      await sendInbox();
    } catch (e) {
      console.warn("[matchBatch] Match in-app notify failed:", e);
    }
  } else if (via === "app") {
    await sendInbox();
  } else {
    await sendMatchEmail();
    await sendPushOnly();
  }

  try {
    const phone = String((preference.contactInfo as any)?.phoneNumber || "").replace(
      /\s/g,
      ""
    );
    if (isLikelyE164CapableLocalPhone(phone) && batchPropertyIds.length > 0) {
      const byId = new Map(propertiesOrdered.map((p: any) => [String(p._id), p]));
      const newPropDocs = batchPropertyIds
        .map((id) => byId.get(String(id)))
        .filter(Boolean) as any[];
      const userName =
        (preference.contactInfo as any)?.fullName ||
        (preference.contactInfo as any)?.contactPerson ||
        "there";
      await runWhatsapp("preference_match_whatsapp", async (wa) => {
        if (newPropDocs.length === 1 && newPropDocs[0]) {
          const p = newPropDocs[0];
          const loc = p.location
            ? [p.location.localGovernment, p.location.state].filter(Boolean).join(", ")
            : "Nigeria";
          const score = Math.round(calculateDetailedMatchScore(p, preference) * 100) / 100;
          await wa.sendNewListingAlert({
            user: { name: userName, phone, id: String(preference.buyer) },
            property: {
              id: String(p._id),
              name: getPropertyTitleFromLocation(p.location) || p.propertyType || "Property",
              location: loc,
              price: p.price,
              bedrooms: p.additionalFeatures?.noOfBedroom,
              bathrooms: p.additionalFeatures?.noOfBathroom,
            } as any,
            matchScore: Math.min(100, Math.max(50, score)),
          });
        } else {
          const list = newPropDocs.slice(0, 3).map((p: any) => ({
            name: getPropertyTitleFromLocation(p.location) || p.propertyType || "Property",
            location: p.location
              ? [p.location.localGovernment, p.location.state].filter(Boolean).join(", ")
              : "Nigeria",
            price: p.price,
            bedrooms: p.additionalFeatures?.noOfBedroom,
            bathrooms: p.additionalFeatures?.noOfBathroom,
            matchScore: calculateDetailedMatchScore(p, preference) / 100,
          }));
          if (list.length) {
            await wa.sendPropertyMatches({
              user: { name: userName, phone, id: String(preference.buyer) },
              matchedProperties: list,
            });
          }
        }
      });
    }
  } catch (e) {
    console.warn("[matchBatch] WhatsApp match notify failed:", e);
  }
}

/**
 * After matchedProperties is saved, reveal the next slice (first batch or catch-up
 * when the buyer had already seen everything) and notify.
 */
export async function revealAndNotifyIfNeeded(params: {
  preference: any;
  matchedRecord: any;
  previousTotal: number;
  previousRevealed: number;
  sendNotify: boolean;
  matchEmailBaseUrlOverride?: string;
  notifyChannels?: MatchNotifyChannels;
}): Promise<{ matchedRecord: any; newlyRevealedIds: Types.ObjectId[] }> {
  const {
    preference,
    previousTotal,
    previousRevealed,
    sendNotify,
    matchEmailBaseUrlOverride,
    notifyChannels,
  } = params;
  const matchedRecord = params.matchedRecord;
  const ids: Types.ObjectId[] = (matchedRecord.matchedProperties || []).map(
    (id: Types.ObjectId) => id
  );
  const total = ids.length;

  if (!matchedRecord.batchAccessToken) {
    matchedRecord.batchAccessToken = generateMatchBatchToken();
  }

  let revealed = previousRevealed;
  let newlyRevealedIds: Types.ObjectId[] = [];

  if (revealed <= 0 && total > 0) {
    revealed = Math.min(MATCH_BATCH_SIZE, total);
    newlyRevealedIds = ids.slice(0, revealed);
  } else if (total > previousTotal && previousRevealed >= previousTotal && previousTotal > 0) {
    const next = Math.min(previousRevealed + MATCH_BATCH_SIZE, total);
    newlyRevealedIds = ids.slice(previousRevealed, next);
    revealed = next;
  }

  matchedRecord.revealedCount = revealed;
  await matchedRecord.save();

  if (sendNotify && newlyRevealedIds.length) {
    await notifyMatchBatch({
      preference,
      matchedRecord,
      batchPropertyIds: newlyRevealedIds,
      matchEmailBaseUrlOverride,
      notifyChannels,
    });
  }

  return { matchedRecord, newlyRevealedIds };
}

export async function pullNextMatchBatch(params: {
  matchedId: string;
  preferenceId: string;
  token?: string;
  notify?: boolean;
}): Promise<{
  matchedRecord: any;
  batch: ReturnType<typeof matchBatchSummary>;
  newlyRevealedIds: Types.ObjectId[];
  matchLink: string;
}> {
  const match = await DB.Models.MatchedPreferenceProperty.findById(params.matchedId);
  if (!match) {
    const err: any = new Error("Matched record not found");
    err.status = 404;
    throw err;
  }
  if (String(match.preference) !== String(params.preferenceId)) {
    const err: any = new Error("Preference does not match this record");
    err.status = 400;
    throw err;
  }
  if (params.token && !tokensMatch(match.batchAccessToken, params.token)) {
    const err: any = new Error("Invalid or expired batch link");
    err.status = 403;
    throw err;
  }

  const preference = await DB.Models.Preference.findById(match.preference).populate("buyer");
  if (!preference) {
    const err: any = new Error("Preference not found");
    err.status = 404;
    throw err;
  }

  const ids: Types.ObjectId[] = (match.matchedProperties || []).map((id: Types.ObjectId) => id);
  const total = ids.length;
  const previousRevealed = effectiveRevealedCount(match);
  if (previousRevealed >= total) {
    const propertiesOrdered = await propertiesForIds(ids);
    const matchBaseUrl = await resolveMatchedPropertiesEmailBaseUrl(propertiesOrdered);
    return {
      matchedRecord: match,
      batch: matchBatchSummary(match),
      newlyRevealedIds: [],
      matchLink: `${matchBaseUrl}/matched-properties/${match._id}/${preference._id}`,
    };
  }

  const next = Math.min(previousRevealed + MATCH_BATCH_SIZE, total);
  const newlyRevealedIds = ids.slice(previousRevealed, next);
  if (!match.batchAccessToken) match.batchAccessToken = generateMatchBatchToken();
  match.revealedCount = next;
  await match.save();

  const notify = params.notify !== false;
  if (notify && newlyRevealedIds.length) {
    await notifyMatchBatch({
      preference,
      matchedRecord: match,
      batchPropertyIds: newlyRevealedIds,
    });
  }

  const propertiesOrdered = await propertiesForIds(ids);
  const matchBaseUrl = await resolveMatchedPropertiesEmailBaseUrl(propertiesOrdered);
  return {
    matchedRecord: match,
    batch: matchBatchSummary(match),
    newlyRevealedIds,
    matchLink: `${matchBaseUrl}/matched-properties/${match._id}/${preference._id}`,
  };
}
