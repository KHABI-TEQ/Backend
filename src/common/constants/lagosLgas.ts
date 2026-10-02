import { normalizeLocationName } from "./pilotLocation";

/**
 * Official Lagos State local government areas.
 * Spellings match the location inventory already used in this product.
 * Areas (Isale Eko, Marina, Fagba, and so on) are not LGAs and are not listed here.
 */
export const LAGOS_LGAS = [
  "Agege",
  "Ajeromi-Ifelodun",
  "Alimosho",
  "Amuwo-Odofin",
  "Apapa",
  "Badagry",
  "Epe",
  "Eti-Osa",
  "Ibeju-Lekki",
  "Ifako-Ijaiye",
  "Ikeja",
  "Ikorodu",
  "Kosofe",
  "Lagos Island",
  "Lagos Mainland",
  "Mushin",
  "Ojo",
  "Oshodi-Isolo",
  "Shomolu",
  "Surulere",
] as const;

export type LagosLga = (typeof LAGOS_LGAS)[number];

const LGA_ALIASES: Record<string, LagosLga> = {
  somolu: "Shomolu",
  "ifako ijaye": "Ifako-Ijaiye",
  "ifako-ijaye": "Ifako-Ijaiye",
};

function lgaLookupKey(value: string): string {
  return normalizeLocationName(value).replace(/-/g, " ");
}

const LGA_BY_KEY = new Map<string, LagosLga>(
  LAGOS_LGAS.map((name) => [lgaLookupKey(name), name])
);

for (const [alias, canonical] of Object.entries(LGA_ALIASES)) {
  LGA_BY_KEY.set(lgaLookupKey(alias), canonical);
}

/** Returns the canonical LGA name, or null when the value is an area or unknown place. */
export function canonicalizeLagosLga(value?: string | null): LagosLga | null {
  if (!value?.trim()) return null;
  return LGA_BY_KEY.get(lgaLookupKey(value)) ?? null;
}

export function canonicalizeLagosLgas(values: string[]): LagosLga[] {
  const seen = new Set<LagosLga>();
  const canonical: LagosLga[] = [];
  for (const value of values) {
    const lga = canonicalizeLagosLga(value);
    if (!lga || seen.has(lga)) continue;
    seen.add(lga);
    canonical.push(lga);
  }
  return canonical;
}
