import { Types } from "mongoose";

function norm(s: unknown): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Fingerprint for “same physical listing” across different agent Property docs.
 * Uses location + type + beds + rounded price — not docs (inconsistent across agents).
 */
export function physicalListingFingerprint(property: any): string {
  const loc = property?.location || {};
  const beds =
    property?.additionalFeatures?.noOfBedroom ??
    property?.noOfBedroom ??
    "";
  const price = Number(property?.price);
  const priceBucket = Number.isFinite(price)
    ? String(Math.round(price / 100_000))
    : "";
  return [
    norm(loc.state),
    norm(loc.localGovernment),
    norm(loc.area),
    norm(loc.streetAddress),
    norm(loc.estate),
    norm(property?.propertyType),
    norm(property?.propertyCategory),
    String(beds),
    priceBucket,
  ].join("|");
}

export type ScoredProperty = {
  property: any;
  matchScore: number;
};

/**
 * Collapse near-duplicate physical listings; keep highest matchScore per fingerprint.
 * Tie-break: prefer listing with estate set, then with street address, then lower ObjectId.
 */
export function dedupeScoredPropertiesByPhysicalIdentity(
  scored: ScoredProperty[],
): ScoredProperty[] {
  const best = new Map<string, ScoredProperty>();

  for (const item of scored) {
    const key = physicalListingFingerprint(item.property);
    const existing = best.get(key);
    if (!existing) {
      best.set(key, item);
      continue;
    }
    if (item.matchScore > existing.matchScore) {
      best.set(key, item);
      continue;
    }
    if (item.matchScore < existing.matchScore) continue;

    const preferNew = preferListing(item.property, existing.property);
    if (preferNew) best.set(key, item);
  }

  return [...best.values()].sort((a, b) => b.matchScore - a.matchScore);
}

function preferListing(a: any, b: any): boolean {
  const aEstate = norm(a?.location?.estate) ? 1 : 0;
  const bEstate = norm(b?.location?.estate) ? 1 : 0;
  if (aEstate !== bEstate) return aEstate > bEstate;
  const aStreet = norm(a?.location?.streetAddress) ? 1 : 0;
  const bStreet = norm(b?.location?.streetAddress) ? 1 : 0;
  if (aStreet !== bStreet) return aStreet > bStreet;
  return String(a?._id || "") < String(b?._id || "");
}

export function toObjectIds(scored: ScoredProperty[]): Types.ObjectId[] {
  return scored.map((x) => new Types.ObjectId(x.property._id));
}
