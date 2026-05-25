/** Values stored on Property.propertyType and used for syndication filtering. */
export const SYNDICATION_PROPERTY_TYPE_VALUES = ["sell", "rent", "jv", "shortlet", "off-plan"] as const;
export type SyndicationPropertyTypeValue = (typeof SYNDICATION_PROPERTY_TYPE_VALUES)[number];

/** UI labels for partner onboarding (checkboxes). */
export const SYNDICATION_PROPERTY_TYPE_LABELS: Record<SyndicationPropertyTypeValue, string> = {
  sell: "Outright Sale",
  rent: "Rent",
  jv: "Joint Ventures",
  shortlet: "Shortlet",
  "off-plan": "Off-Plan",
};

const ALLOWED = new Set<string>(SYNDICATION_PROPERTY_TYPE_VALUES);

/** Normalize client input (checkbox array or CSV) to unique allowed slugs. */
export function normalizeSyndicationPropertyTypesInput(input: unknown): SyndicationPropertyTypeValue[] {
  const raw: unknown[] = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/[\s,]+/).filter(Boolean)
      : [];
  const out = new Set<SyndicationPropertyTypeValue>();
  for (const x of raw) {
    const v = String(x || "").trim().toLowerCase();
    if (ALLOWED.has(v)) out.add(v as SyndicationPropertyTypeValue);
  }
  return [...out];
}

/** If field is missing (legacy), accept all. Empty array = partner accepts no listing types (no jobs). */
export function platformAcceptsSyndicationPropertyType(
  platform: { acceptedPropertyTypes?: string[] | null } | null | undefined,
  propertyType: string | undefined | null
): boolean {
  const allowed = platform?.acceptedPropertyTypes;
  if (allowed == null || !Array.isArray(allowed)) return true;
  if (allowed.length === 0) return false;
  const pt = String(propertyType || "").trim().toLowerCase();
  if (!pt) return false;
  return allowed.some((a) => String(a || "").trim().toLowerCase() === pt);
}
