/** Case-insensitive alphabetical compare for location labels. */
export function compareLocationLabels(a: string, b: string): number {
  return String(a || "").trim().localeCompare(String(b || "").trim(), undefined, {
    sensitivity: "base",
  });
}

export type AreaWithEstates = { areaName: string; estates: string[] };

export type LgaWithAreas = {
  lgaName: string;
  areas: string[];
  areasWithEstates?: AreaWithEstates[];
};

/**
 * Sort LGAs, nested areas, and estates A→Z for API responses and persisted preference location.
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
      .map((entry) => {
        const areas = Array.isArray(entry?.areas)
          ? [...entry.areas].map((a) => String(a).trim()).filter(Boolean).sort(compareLocationLabels)
          : [];
        const areasWithEstates = Array.isArray(entry?.areasWithEstates)
          ? [...entry.areasWithEstates]
              .map((row) => ({
                areaName: String(row?.areaName || "").trim(),
                estates: Array.isArray(row?.estates)
                  ? [...row.estates]
                      .map((e) => String(e).trim())
                      .filter(Boolean)
                      .sort(compareLocationLabels)
                  : [],
              }))
              .filter((r) => r.areaName && r.estates.length > 0)
              .sort((a, b) => compareLocationLabels(a.areaName, b.areaName))
          : [];
        return {
          lgaName: String(entry?.lgaName || "").trim(),
          areas,
          ...(areasWithEstates.length ? { areasWithEstates } : {}),
        };
      })
      .filter((e) => e.lgaName)
      .sort((a, b) => compareLocationLabels(a.lgaName, b.lgaName));
  }

  return out;
}
