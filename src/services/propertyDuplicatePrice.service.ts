import { Types } from "mongoose";
import { DB } from "../controllers";
import HttpStatusCodes from "../common/HttpStatusCodes";
import { RouteError } from "../common/classes";
import { isPropertyListedAndMatchable } from "./autoPreferencePairing.service";
import { liveListingMongoFilter } from "../utils/liveListingFilter";
import {
  PreparedImageEmbedding,
  findLiveImageMatches,
} from "./propertyImageEmbedding.service";

export { liveListingMongoFilter, LIVE_LISTING_STATUSES_EXCLUDED } from "../utils/liveListingFilter";

function norm(s: unknown): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function streetAddressOf(property: any): string {
  return (
    property?.location?.streetAddress ||
    property?.shortletDetails?.streetAddress ||
    ""
  );
}

function identityKeyIsStrong(property: any): boolean {
  return !!(norm(streetAddressOf(property)) || norm(property?.location?.estate));
}

/**
 * Location + type + rooms identity (no price). Returns null when street and estate
 * are both empty — too weak to treat as the same physical unit.
 */
export function physicalPropertyIdentityKey(property: any): string | null {
  if (!identityKeyIsStrong(property)) return null;
  const loc = property?.location || {};
  const beds =
    property?.additionalFeatures?.noOfBedroom ?? property?.noOfBedroom ?? "";
  const baths =
    property?.additionalFeatures?.noOfBathroom ?? property?.noOfBathroom ?? "";
  return [
    norm(loc.state),
    norm(loc.localGovernment),
    norm(loc.area),
    norm(loc.estate),
    norm(streetAddressOf(property)),
    norm(property?.propertyType),
    norm(property?.propertyCategory),
    String(beds),
    String(baths),
  ].join("|");
}

export function listingNairaPrice(property: any): number | null {
  if (property?.price != null && property.price !== "") {
    const price = Number(property.price);
    if (Number.isFinite(price)) return Math.round(price);
  }
  const nightlyRaw =
    property?.pricing?.nightly ?? property?.shortletDetails?.pricing?.nightly;
  if (nightlyRaw != null && nightlyRaw !== "") {
    const nightly = Number(nightlyRaw);
    if (Number.isFinite(nightly)) return Math.round(nightly);
  }
  return null;
}

export function formatListedNaira(naira: number): string {
  return `₦${Math.round(naira).toLocaleString("en-NG")}`;
}

export function alreadyListedAtPriceMessage(naira: number): string {
  return `This property is already on the system at ${formatListedNaira(naira)}. You can only list it at that price.`;
}

function idsEqual(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

export function pictureUrlsChanged(
  current: unknown,
  incoming: unknown,
): boolean {
  if (incoming === undefined) return false;
  const a = (Array.isArray(current) ? current : []).map(String).sort();
  const b = (Array.isArray(incoming) ? incoming : []).map(String).sort();
  if (a.length !== b.length) return true;
  return a.some((url, i) => url !== b[i]);
}

export async function findLiveIdentityMatches(
  property: any,
  excludePropertyId?: string | Types.ObjectId | unknown,
): Promise<any[]> {
  const key = physicalPropertyIdentityKey(property);
  if (!key) return [];

  const loc = property?.location || {};
  const state = String(loc.state || "").trim();
  const lga = String(loc.localGovernment || "").trim();
  if (!state || !lga) return [];

  const beds = Number(
    property?.additionalFeatures?.noOfBedroom ?? property?.noOfBedroom,
  );

  const query: Record<string, unknown> = {
    ...liveListingMongoFilter(),
    "location.state": new RegExp(`^${escapeRegex(state)}$`, "i"),
    "location.localGovernment": new RegExp(`^${escapeRegex(lga)}$`, "i"),
  };
  if (property?.propertyType) {
    query.propertyType = new RegExp(
      `^${escapeRegex(String(property.propertyType).trim())}$`,
      "i",
    );
  }
  if (Number.isFinite(beds)) {
    query["additionalFeatures.noOfBedroom"] = { $in: [beds, String(beds)] };
  }
  if (excludePropertyId) {
    query._id = { $ne: new Types.ObjectId(String(excludePropertyId)) };
  }

  const candidates = await DB.Models.Property.find(query).lean();
  return candidates.filter((p) => {
    if (!isPropertyListedAndMatchable(p)) return false;
    return physicalPropertyIdentityKey(p) === key;
  });
}

export async function assertAgentListingPriceConsistent(opts: {
  property: any;
  excludePropertyId?: string | Types.ObjectId | unknown;
  incomingEmbeddings?: PreparedImageEmbedding[];
}): Promise<void> {
  const incomingPrice = listingNairaPrice(opts.property);
  if (incomingPrice == null) return;

  const identityMatches = await findLiveIdentityMatches(
    opts.property,
    opts.excludePropertyId,
  );

  let imageMatches: any[] = [];
  try {
    const vectors = (opts.incomingEmbeddings || [])
      .map((e) => e.embedding)
      .filter((e) => Array.isArray(e) && e.length > 0);
    if (vectors.length) {
      imageMatches = await findLiveImageMatches(
        vectors,
        {
          state: opts.property?.location?.state,
          localGovernment: opts.property?.location?.localGovernment,
        },
        opts.excludePropertyId,
      );
    }
  } catch (err) {
    console.warn(
      "[assertAgentListingPriceConsistent] image match failed (identity still enforced):",
      err,
    );
  }

  const seen = new Set<string>();
  const candidates: any[] = [];
  for (const p of [...identityMatches, ...imageMatches]) {
    const id = String(p?._id || "");
    if (!id || seen.has(id)) continue;
    if (idsEqual(id, opts.excludePropertyId)) continue;
    seen.add(id);
    candidates.push(p);
  }

  for (const existing of candidates) {
    const listed = listingNairaPrice(existing);
    if (listed == null) continue;
    if (listed !== incomingPrice) {
      throw new RouteError(
        HttpStatusCodes.CONFLICT,
        alreadyListedAtPriceMessage(listed),
      );
    }
  }
}
