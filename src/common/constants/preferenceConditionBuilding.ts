/** Shared preference condition + building-type catalogs (form, AI, API). */

export const PREFERENCE_PROPERTY_CONDITIONS = [
  { value: "brand-new", label: "Brand New" },
  { value: "fairly-new", label: "Fairly New" },
  { value: "good-condition", label: "Good Condition" },
  { value: "fairly-used", label: "Fairly Used" },
  { value: "old-building", label: "Old Building" },
  { value: "needs-renovation", label: "Needs Renovation" },
  { value: "any-condition", label: "Any Condition" },
] as const;

export const PREFERENCE_BUILDING_TYPES = [
  { value: "duplex", label: "Duplex" },
  { value: "bungalow", label: "Bungalow" },
  { value: "flat-apartment", label: "Flat/Apartment" },
  { value: "terraced-house", label: "Terraced House" },
  { value: "detached-house", label: "Detached House" },
  { value: "semi-detached-house", label: "Semi-Detached House" },
  { value: "any-type", label: "Any Type" },
] as const;

export const PREFERENCE_PROPERTY_CONDITION_VALUES = PREFERENCE_PROPERTY_CONDITIONS.map(
  (o) => o.value,
);

export const PREFERENCE_BUILDING_TYPE_VALUES = PREFERENCE_BUILDING_TYPES.map(
  (o) => o.value,
);

const CONDITION_ALIASES: Record<string, string> = {
  new: "brand-new",
  newer: "brand-new",
  "brand new": "brand-new",
  "brand-new": "brand-new",
  "fairly new": "fairly-new",
  "fairly-new": "fairly-new",
  good: "good-condition",
  "good condition": "good-condition",
  "good-condition": "good-condition",
  goodcondition: "good-condition",
  used: "fairly-used",
  "fairly used": "fairly-used",
  "fairly-used": "fairly-used",
  old: "old-building",
  "old building": "old-building",
  "old-building": "old-building",
  renovation: "needs-renovation",
  renovated: "needs-renovation",
  "needs renovation": "needs-renovation",
  "needs-renovation": "needs-renovation",
  any: "any-condition",
  "any condition": "any-condition",
  "any-condition": "any-condition",
};

const BUILDING_ALIASES: Record<string, string> = {
  duplex: "duplex",
  bungalow: "bungalow",
  flat: "flat-apartment",
  apartment: "flat-apartment",
  "flat/apartment": "flat-apartment",
  "flat-apartment": "flat-apartment",
  "blocks of flat": "flat-apartment",
  "blocks of flats": "flat-apartment",
  "block of flats": "flat-apartment",
  "blocks-of-flat": "flat-apartment",
  "block-of-flats": "flat-apartment",
  terrace: "terraced-house",
  terraced: "terraced-house",
  "terraced house": "terraced-house",
  "terraced-house": "terraced-house",
  "duplex-terrace": "terraced-house",
  detached: "detached-house",
  "detached house": "detached-house",
  "detached-house": "detached-house",
  "duplex-fully-detached": "detached-house",
  "semi-detached": "semi-detached-house",
  "semi detached": "semi-detached-house",
  "semi-detached house": "semi-detached-house",
  "semi-detached-house": "semi-detached-house",
  "duplex-semi-detached": "semi-detached-house",
  any: "any-type",
  "any type": "any-type",
  "any-type": "any-type",
};

function normalizeLookup(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizePreferenceCondition(raw: unknown): string | null {
  const t = normalizeLookup(raw);
  if (!t) return null;
  const byLabel = PREFERENCE_PROPERTY_CONDITIONS.find(
    (o) => o.value === t || o.label.toLowerCase() === t,
  );
  if (byLabel) return byLabel.value;
  return CONDITION_ALIASES[t] || null;
}

export function normalizePreferenceBuildingType(raw: unknown): string | null {
  const t = normalizeLookup(raw);
  if (!t) return null;
  const byLabel = PREFERENCE_BUILDING_TYPES.find(
    (o) => o.value === t || o.label.toLowerCase() === t,
  );
  if (byLabel) return byLabel.value;
  return BUILDING_ALIASES[t] || null;
}
