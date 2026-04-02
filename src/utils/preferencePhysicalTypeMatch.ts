/**
 * Brief / transaction types stored on Property.propertyType (listing kind).
 * Distinct from the buyer's "physical" type (flat, land, etc.) in propertyDetails.propertyType.
 */
const BRIEF_LISTING_KIND_VALUES = new Set([
  "sell",
  "jv",
  "rent",
  "shortlet",
  "buy",
  "joint-venture",
]);

function norm(s: string): string {
  return String(s ?? "").trim().toLowerCase();
}

/**
 * Physical type the buyer specified (optional). If absent, pairing does not filter on physical type.
 */
export function getPreferencePhysicalPropertyType(preference: any): string | null {
  const pt =
    preference?.propertyDetails?.propertyType ||
    preference?.bookingDetails?.propertyType ||
    preference?.developmentDetails?.propertyType;
  const s = pt != null ? String(pt).trim() : "";
  return s.length ? s : null;
}

/**
 * Best-effort physical type on a listing for comparison to the preference.
 * Prefers propertyCategory; ignores propertyType when it holds only brief kind (sell/jv/…).
 */
export function getListingPhysicalPropertyType(property: any): string | null {
  const cat = property?.propertyCategory != null ? String(property.propertyCategory).trim() : "";
  if (cat) return cat;

  const pt = property?.propertyType != null ? String(property.propertyType).trim() : "";
  if (pt && !BRIEF_LISTING_KIND_VALUES.has(norm(pt))) return pt;

  const tb = property?.typeOfBuilding != null ? String(property.typeOfBuilding).trim() : "";
  return tb.length ? tb : null;
}

/**
 * When the buyer specified a physical property type, it must match the listing (case-insensitive trim).
 * When the buyer omitted it, any listing type is allowed (same as before).
 */
export function preferencePhysicalTypeMatches(preference: any, property: any): boolean {
  const want = getPreferencePhysicalPropertyType(preference);
  if (!want) return true;
  const have = getListingPhysicalPropertyType(property);
  if (!have) return false;
  return norm(want) === norm(have);
}
