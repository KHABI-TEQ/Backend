/** Normalize state/LGA tokens for comparison (case- and spacing-insensitive). */
export function normalizeLocationToken(value?: string | null): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Parse admin `regionOfOperation` entries:
 * - `"ikeja, lagos"` → LGA + state
 * - `"lagos"` → state-only coverage
 */
export function parseRegionOfOperationEntry(entry: string): {
  lga?: string;
  state?: string;
} {
  const normalized = normalizeLocationToken(entry);
  if (!normalized) return {};

  const parts = normalized.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { lga: parts[0], state: parts.slice(1).join(", ") };
  }
  return { state: parts[0] };
}

/**
 * LGA is the primary matching yardstick; state-only regions apply when no LGA is known.
 */
export function regionEntryMatchesPropertyLocation(
  entry: string,
  propertyState?: string,
  propertyLga?: string,
): boolean {
  const normState = normalizeLocationToken(propertyState);
  const normLga = normalizeLocationToken(propertyLga);
  const { lga, state } = parseRegionOfOperationEntry(entry);

  if (normLga) {
    return Boolean(lga && lga === normLga);
  }

  if (normState) {
    if (state === normState) return true;
    if (!lga && state === normState) return true;
  }

  return false;
}

/** BSON regex query — matches any `regionOfOperation` array element (Atlas-safe, no `$expr`). */
export function buildFieldAgentLgaRegionRegexQuery(
  localGovernment: string,
): { $regex: string; $options: string } {
  const lga = escapeRegex(normalizeLocationToken(localGovernment));
  return { $regex: `^${lga}(\\s*,|$)`, $options: "i" };
}

/** `$match` stage: LGA is the primary yardstick (`"ikeja, lagos"` etc.). */
export function buildFieldAgentLgaRegionMatchStage(
  localGovernment: string,
): { $match: Record<string, unknown> } {
  return {
    $match: {
      "fieldAgentProfile.regionOfOperation": buildFieldAgentLgaRegionRegexQuery(
        localGovernment,
      ),
    },
  };
}

/** Mongo regex: match state-only or `lga, state` entries when only state is known. */
export function buildFieldAgentStateRegionRegexQuery(
  state: string,
): { $regex: string; $options: string } {
  const st = escapeRegex(normalizeLocationToken(state));
  return { $regex: `(^${st}$|,\\s*${st}\\s*$)`, $options: "i" };
}
