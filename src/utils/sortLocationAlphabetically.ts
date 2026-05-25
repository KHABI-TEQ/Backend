/** Case-insensitive alphabetical compare for location labels. */
export function compareLocationLabels(a: string, b: string): number {
  return String(a || "").trim().localeCompare(String(b || "").trim(), undefined, {
    sensitivity: "base",
  });
}

export type LgaWithAreas = { lgaName: string; areas: string[] };

/**
 * Sort LGAs and nested areas A→Z for API responses and persisted preference location.
 */
export function sortPreferenceLocationAlphabetically<T extends {
  localGovernmentAreas?: string[];
  lgasWithAreas?: LgaWithAreas[];
}>(location: T | undefined | null): T | undefined | null {
  if (!location) return location;

  const out = { ...location };

  if (Array.isArray(out.localGovernmentAreas) && out.localGovernmentAreas.length > 0) {
    out.localGovernmentAreas = [...out.localGovernmentAreas]
      .map((s) => String(s).trim())
      .filter(Boolean)
      .sort(compareLocationLabels);
  }

  if (Array.isArray(out.lgasWithAreas) && out.lgasWithAreas.length > 0) {
    out.lgasWithAreas = [...out.lgasWithAreas]
      .map((entry) => ({
        lgaName: String(entry?.lgaName || "").trim(),
        areas: Array.isArray(entry?.areas)
          ? [...entry.areas].map((a) => String(a).trim()).filter(Boolean).sort(compareLocationLabels)
          : [],
      }))
      .filter((e) => e.lgaName)
      .sort((a, b) => compareLocationLabels(a.lgaName, b.lgaName));
  }

  return out;
}
