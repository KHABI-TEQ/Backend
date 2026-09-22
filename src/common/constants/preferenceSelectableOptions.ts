/** Selectable preference catalogs shared with the AI chips and manual form. */

export const PREFERENCE_DOCUMENT_TYPES = [
  { value: "deed-of-assignment", label: "Deed of Assignment" },
  { value: "deed-of-ownership", label: "Deed of Ownership" },
  { value: "deed-of-conveyance", label: "Deed of Conveyance" },
  { value: "survey-plan", label: "Survey Plan" },
  { value: "governors-consent", label: "Governor's Consent" },
  { value: "certificate-of-occupancy", label: "Certificate of Occupancy" },
  { value: "family-receipt", label: "Family Receipt" },
  { value: "contract-of-sale", label: "Contract of Sale" },
  { value: "land-certificate", label: "Land Certificate" },
  { value: "gazette", label: "Gazette" },
  { value: "excision", label: "Excision" },
] as const;

export const PREFERENCE_DOCUMENT_TYPE_VALUES = PREFERENCE_DOCUMENT_TYPES.map(
  (d) => d.value
);

export const JV_DEVELOPMENT_TYPES = [
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "mixed-use", label: "Mixed-use Development" },
  { value: "industrial", label: "Industrial" },
] as const;

export const JV_DEVELOPMENT_TYPE_VALUES = JV_DEVELOPMENT_TYPES.map((d) => d.value);

export const SHORTLET_TRAVEL_TYPES = [
  { value: "solo", label: "Solo" },
  { value: "couple", label: "Couple" },
  { value: "family", label: "Family" },
  { value: "group", label: "Group" },
  { value: "business", label: "Business" },
] as const;

export const SHORTLET_TRAVEL_TYPE_VALUES = SHORTLET_TRAVEL_TYPES.map((d) => d.value);

export const SHORTLET_PROPERTY_TYPES = [
  { value: "studio", label: "Studio" },
  { value: "apartment", label: "Apartment" },
  { value: "duplex", label: "Duplex" },
  { value: "bungalow", label: "Bungalow" },
] as const;

export const OFF_PLAN_DEVELOPMENT_STAGES = [
  { value: "planning", label: "Planning Stage" },
  { value: "foundation", label: "Foundation Stage" },
  { value: "structural", label: "Structural Stage" },
  { value: "finishing", label: "Finishing Stage" },
  { value: "near-completion", label: "Near Completion" },
] as const;

export const OFF_PLAN_PAYMENT_PLANS = [
  { value: "outright", label: "Outright Payment" },
  { value: "installment-6-months", label: "6 Months Installment" },
  { value: "installment-12-months", label: "12 Months Installment" },
  { value: "installment-18-months", label: "18 Months Installment" },
  { value: "installment-24-months", label: "24 Months Installment" },
  { value: "installment-36-months", label: "36 Months Installment" },
] as const;

function lookup(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\s+/g, " ");
}

function matchCatalog(
  raw: unknown,
  options: ReadonlyArray<{ value: string; label: string }>
): string | null {
  const t = lookup(raw);
  if (!t) return null;
  const hit = options.find(
    (o) =>
      o.value === t ||
      o.label.toLowerCase() === t ||
      o.label.toLowerCase().replace(/['’]/g, "") === t
  );
  return hit?.value ?? null;
}

export function normalizePreferenceDocumentType(raw: unknown): string | null {
  const t = lookup(raw);
  if (!t) return null;
  const hit = matchCatalog(t, PREFERENCE_DOCUMENT_TYPES);
  if (hit) return hit;
  if (/c\s*of\s*o|certificate of occup/.test(t)) return "certificate-of-occupancy";
  if (/governor/.test(t)) return "governors-consent";
  if (/deed of assign/.test(t)) return "deed-of-assignment";
  if (/deed of own/.test(t)) return "deed-of-ownership";
  if (/deed of convey/.test(t)) return "deed-of-conveyance";
  if (/survey/.test(t)) return "survey-plan";
  if (/family receipt/.test(t)) return "family-receipt";
  if (/contract of sale/.test(t)) return "contract-of-sale";
  if (/land certificate/.test(t)) return "land-certificate";
  if (/gazette/.test(t)) return "gazette";
  if (/excision/.test(t)) return "excision";
  return null;
}

export function normalizePreferenceDocumentTypeList(raw: unknown): string[] {
  const parts = Array.isArray(raw)
    ? raw
    : String(raw ?? "")
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const value = normalizePreferenceDocumentType(part);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

export function normalizeJvDevelopmentType(raw: unknown): string | null {
  const t = lookup(raw);
  if (!t) return null;
  const hit = matchCatalog(t, JV_DEVELOPMENT_TYPES);
  if (hit) return hit;
  if (t.includes("mixed")) return "mixed-use";
  if (t.includes("resid") || /\b(flat|apartment|duplex|bungalow|terrace)\b/.test(t)) {
    return "residential";
  }
  if (t.includes("commerc")) return "commercial";
  if (t.includes("industri")) return "industrial";
  return null;
}

export function normalizeJvDevelopmentTypeList(raw: unknown): string[] {
  const parts = Array.isArray(raw) ? raw : String(raw ?? "").split(/[,;]/);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const value = normalizeJvDevelopmentType(part);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

export function normalizeTravelType(raw: unknown): string | null {
  const t = lookup(raw);
  if (!t) return null;
  const hit = matchCatalog(t, SHORTLET_TRAVEL_TYPES);
  if (hit) return hit;
  if (/famil/.test(t)) return "family";
  if (/couple|romantic/.test(t)) return "couple";
  if (/group/.test(t)) return "group";
  if (/business|work|corporate/.test(t)) return "business";
  if (/solo|alone|single/.test(t)) return "solo";
  return null;
}

export function normalizeShortletPropertyType(raw: unknown): string | null {
  const t = lookup(raw);
  if (!t) return null;
  const hit = matchCatalog(t, SHORTLET_PROPERTY_TYPES);
  if (hit) return hit;
  if (/\bstudio\b/.test(t)) return "studio";
  if (/\bapartment|flat\b/.test(t)) return "apartment";
  if (/\bduplex\b/.test(t)) return "duplex";
  if (/\bbungalow\b/.test(t)) return "bungalow";
  return null;
}

export function normalizeOffPlanDevelopmentStage(raw: unknown): string | null {
  return matchCatalog(raw, OFF_PLAN_DEVELOPMENT_STAGES);
}

export function normalizeOffPlanPaymentPlan(raw: unknown): string | null {
  return matchCatalog(raw, OFF_PLAN_PAYMENT_PLANS);
}
