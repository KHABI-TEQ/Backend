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

/**
 * Mongo regex: match `regionOfOperation` array elements for a property LGA (e.g. `ikeja, lagos`).
 */
export function buildFieldAgentLgaRegionRegex(localGovernment: string): RegExp {
  const lga = escapeRegex(normalizeLocationToken(localGovernment));
  return new RegExp(`^${lga}(\\s*,|$)`, "i");
}

/** `$match` stage: any `regionOfOperation` entry whose LGA matches (primary yardstick). */
export function buildFieldAgentLgaRegionExprMatch(
  localGovernment: string,
): Record<string, unknown> {
  const lga = escapeRegex(normalizeLocationToken(localGovernment));
  const lgaRegex = `^${lga}(\\s*,|$)`;

  return {
    $expr: {
      $gt: [
        {
          $size: {
            $filter: {
              input: { $ifNull: ["$fieldAgentProfile.regionOfOperation", []] },
              as: "region",
              cond: {
                $regexMatch: {
                  input: {
                    $toLower: {
                      $trim: { input: { $toString: "$$region" } },
                    },
                  },
                  regex: lgaRegex,
                },
              },
            },
          },
        },
        0,
      ],
    },
  };
}

/** Mongo regex: match state-only or `lga, state` entries when only state is known. */
export function buildFieldAgentStateRegionRegex(state: string): RegExp {
  const st = escapeRegex(normalizeLocationToken(state));
  return new RegExp(`(^${st}$|,?\\s*${st}\\s*$)`, "i");
}
