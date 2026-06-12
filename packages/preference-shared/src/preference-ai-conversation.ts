/**
 * Form-aligned AI conversation: ordered fields per preference type, budget parsing, type-first gate.
 */

import { normalizeNigerianPhoneNumber, parseNigerianPhoneFromText } from "./phone";
import { prepareTextForNaturalSpeech } from "./tts";
import { getAreasByLGA, getLGAsByState } from "./location-resolver";
import type { PreferenceType } from "./schema";
import { isLongMultiFieldUtterance } from "./suggest-input";

export type NormalizedPreferenceType = PreferenceType;

/** One conversational step aligned with manual form requirements. */
export type ConversationFieldId =
  | "preference_type"
  | "state"
  | "lga"
  | "area"
  | "property_subtype"
  | "measurement_unit"
  | "land_size_single"
  | "land_size_sqm_min"
  | "land_size_sqm_max"
  | "document_types"
  | "land_conditions"
  | "property_condition"
  | "building_type"
  | "bedrooms"
  | "bathrooms"
  | "lease_term"
  | "purpose"
  | "min_budget"
  | "max_budget"
  | "phone"
  | "shortlet_property_type"
  | "shortlet_guests"
  | "travel_type"
  | "check_in"
  | "check_out"
  | "jv_development_types"
  | "jv_measurement_unit"
  | "jv_min_land_size"
  | "jv_sharing_ratio"
  | "jv_title_requirements"
  | "jv_company_name"
  | "off_plan_completion_date"
  | "off_plan_development_stage"
  | "off_plan_payment_plan"
  | "features"
  | "car_parks"
  | "additional_notes";

const TOAST_LABEL: Record<ConversationFieldId, string> = {
  preference_type: "preference type (Buy, Rent, JV, Shortlet, or Off-Plan)",
  state: "state",
  lga: "local government area (LGA)",
  area: "area or neighbourhood",
  property_subtype: "property subtype",
  measurement_unit: "measurement unit for land size",
  land_size_single: "land size",
  land_size_sqm_min: "minimum land size (sqm)",
  land_size_sqm_max: "maximum land size (sqm)",
  document_types: "title / document types",
  land_conditions: "land conditions",
  property_condition: "property condition",
  building_type: "building type",
  bedrooms: "number of bedrooms",
  bathrooms: "number of bathrooms",
  lease_term: "lease term",
  purpose: "purpose (residential or office)",
  min_budget: "minimum budget",
  max_budget: "maximum budget",
  phone: "phone number",
  shortlet_property_type: "shortlet property type",
  shortlet_guests: "number of guests",
  travel_type: "travel type",
  check_in: "check-in date",
  check_out: "check-out date",
  jv_development_types: "development type(s) for JV",
  jv_measurement_unit: "land measurement unit (JV)",
  jv_min_land_size: "minimum land size (JV)",
  jv_sharing_ratio: "preferred sharing ratio (JV)",
  jv_title_requirements: "minimum title requirements (JV)",
  jv_company_name: "company name (JV)",
  off_plan_completion_date: "expected completion date (off-plan)",
  off_plan_development_stage: "development stage (off-plan)",
  off_plan_payment_plan: "payment plan (off-plan)",
  features: "features and amenities",
  car_parks: "number of car parks",
  additional_notes: "additional description or notes",
};

export function formatConversationFieldsForToast(ids: ConversationFieldId[]): string {
  return ids.map((id) => TOAST_LABEL[id] ?? id).join(", ");
}

function getLoc(data: Record<string, unknown>): Record<string, unknown> | null {
  const loc = data.location;
  if (loc && typeof loc === "object" && !Array.isArray(loc)) return loc as Record<string, unknown>;
  return null;
}

function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function splitSelectionInput(text: string): string[] {
  return text
    .split(/,|\/|\band\b|;/gi)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Empty for merge: do not let API wipe prior fields with {}, [], or "". */
function isEmptyMergeValue(val: unknown): boolean {
  if (val === undefined || val === null) return true;
  if (typeof val === "string") return val.trim() === "";
  if (Array.isArray(val)) return val.length === 0;
  if (typeof val === "object") return Object.keys(val as object).length === 0;
  return false;
}

function mergeSelectedAreasMaps(existing: unknown, incoming: unknown): Record<string, unknown> {
  const prev =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return prev;
  const inc = incoming as Record<string, unknown>;
  const out = { ...prev };
  for (const [lga, areas] of Object.entries(inc)) {
    if (areas === undefined || isEmptyMergeValue(areas)) continue;
    const p = out[lga];
    const add = Array.isArray(areas)
      ? areas.map(String).map((s) => s.trim()).filter(Boolean)
      : [String(areas).trim()].filter(Boolean);
    if (add.length === 0) continue;
    if (isEmptyMergeValue(p)) out[lga] = add;
    else if (Array.isArray(p)) {
      const cur = p.map(String);
      for (const a of add) {
        if (!cur.some((x) => x.toLowerCase() === a.toLowerCase())) cur.push(a);
      }
      out[lga] = cur;
    } else {
      out[lga] = [String(p), ...add];
    }
  }
  return out;
}

function mergeLocationPayload(prev: Record<string, unknown> | undefined, inc: unknown): Record<string, unknown> {
  const base = prev && typeof prev === "object" && !Array.isArray(prev) ? { ...prev } : {};
  if (!inc || typeof inc !== "object" || Array.isArray(inc)) return base;
  const incoming = inc as Record<string, unknown>;
  for (const [k, v] of Object.entries(incoming)) {
    if (v === undefined) continue;
    if (isEmptyMergeValue(v)) continue;
    const ex = base[k];
    if (k === "selectedAreas") {
      if (isEmptyMergeValue(v)) continue;
      base[k] = mergeSelectedAreasMaps(base[k], v);
      continue;
    }
    if (k === "localGovernmentAreas" || k === "lgas") {
      if (!Array.isArray(v) || v.length === 0) continue;
      const arr = v.map(String).map((s) => s.trim()).filter(Boolean);
      const prevLga = base.localGovernmentAreas ?? base.lgas;
      const prevArr = Array.isArray(prevLga) ? prevLga.map(String).map((s) => s.trim()).filter(Boolean) : [];
      if (prevArr.length === 0) base.localGovernmentAreas = arr;
      else base.localGovernmentAreas = [...new Set([...prevArr, ...arr])];
      delete base.lgas;
      continue;
    }
    if (k === "areas") {
      if (Array.isArray(v) && v.length > 0) {
        const lgas = base.localGovernmentAreas;
        const lgaList = Array.isArray(lgas) ? lgas.map(String).map((s) => s.trim()).filter(Boolean) : [];
        if (lgaList.length === 1) {
          base.selectedAreas = mergeSelectedAreasMaps(base.selectedAreas, { [lgaList[0]]: v });
        } else {
          const joined = v.map(String).join(", ");
          const prevC = typeof base.customLocation === "string" ? base.customLocation.trim() : "";
          base.customLocation = prevC ? `${prevC}; ${joined}` : joined;
        }
      } else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
        base.selectedAreas = mergeSelectedAreasMaps(base.selectedAreas, v);
      }
      continue;
    }
    if (k === "state") {
      if (typeof v === "string" && v.trim() !== "") base[k] = v.trim();
      continue;
    }
    if (k === "customLocation") {
      if (typeof v === "string" && v.trim() !== "") base[k] = v.trim();
      continue;
    }
    if (isEmptyMergeValue(ex)) base[k] = v;
  }
  return base;
}

/**
 * Merge each new suggest-preference response onto data we already collected.
 * Without this, a partial API payload drops nested fields (e.g. selectedAreas) from earlier turns.
 */
export function mergeAiSuggestOntoCollected(
  prev: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  if (!prev || typeof prev !== "object") return { ...incoming };
  const out: Record<string, unknown> = { ...prev };
  for (const [key, incVal] of Object.entries(incoming)) {
    if (incVal === undefined) continue;
    // Never replace filled fields with empty payloads from partial API responses (e.g. measurementUnit: "").
    if (isEmptyMergeValue(incVal)) continue;
    if (key === "location") {
      out[key] = mergeLocationPayload(getLoc(prev) ?? undefined, incVal);
      continue;
    }
    const curVal = out[key];
    if (isEmptyMergeValue(curVal)) {
      out[key] = incVal;
    } else if (
      typeof curVal === "object" &&
      curVal !== null &&
      !Array.isArray(curVal) &&
      typeof incVal === "object" &&
      incVal !== null &&
      !Array.isArray(incVal)
    ) {
      out[key] = mergeAiSuggestOntoCollected(curVal as Record<string, unknown>, incVal as Record<string, unknown>);
    }
  }
  return out;
}

/**
 * Strip fields the AI conversation must collect explicitly (not inferred from suggest-preference alone).
 */
export function sanitizeSuggestPreferenceForAiConversation(
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...incoming };
  if (next.propertyDetails && typeof next.propertyDetails === "object" && !Array.isArray(next.propertyDetails)) {
    const pd = { ...(next.propertyDetails as Record<string, unknown>) };
    delete pd.bathrooms;
    delete pd.minBathrooms;
    delete pd.numBathrooms;
    delete pd.bathroomCount;
    delete pd.noOfCarPark;
    next.propertyDetails = pd;
  }
  if (next.features && typeof next.features === "object" && !Array.isArray(next.features)) {
    const f = { ...(next.features as Record<string, unknown>) };
    delete f.baseFeatures;
    delete f.basicFeatures;
    delete f.premiumFeatures;
    delete f.comfortFeatures;
    next.features = f;
  }
  if (typeof next.additionalNotes === "string" && next.additionalNotes.trim() !== "") {
    delete next.additionalNotes;
  }
  return next;
}

/** When the user is answering the area step, pin their text into location so we advance even if the API omits areas. */
export function mergeUserAreaReplyIntoLocation(data: Record<string, unknown>, userText: string): Record<string, unknown> {
  const t = userText.trim();
  if (!t) return data;
  const loc = getLoc(data);
  if (!loc) return data;
  const next: Record<string, unknown> = { ...loc };
  const lgasRaw = next.localGovernmentAreas ?? next.lgas;
  const lgaList = Array.isArray(lgasRaw)
    ? lgasRaw.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim())
    : [];
  if (lgaList.length === 1) {
    const lga = lgaList[0];
    const prevSel =
      next.selectedAreas && typeof next.selectedAreas === "object" && !Array.isArray(next.selectedAreas)
        ? { ...(next.selectedAreas as Record<string, unknown>) }
        : {};
    const existing = Array.isArray(prevSel[lga]) ? (prevSel[lga] as unknown[]).map(String) : [];
    const exists = existing.some((x) => x.trim().toLowerCase() === t.toLowerCase());
    next.selectedAreas = { ...prevSel, [lga]: exists ? existing : [...existing, t] };
  } else {
    const prevC = typeof next.customLocation === "string" && next.customLocation.trim() ? next.customLocation.trim() : "";
    next.customLocation = prevC ? `${prevC}; ${t}` : t;
  }
  return { ...data, location: next };
}

/** Merge a typed LGA reply using available LGAs under the selected state. */
export function mergeUserLgaReplyIntoLocation(
  data: Record<string, unknown>,
  userText: string
): Record<string, unknown> {
  const t = userText.trim();
  if (!t) return data;
  const loc = getLoc(data);
  if (!loc) return data;
  const state = String(loc.state ?? "").trim();
  if (!state) return data;
  const available = getLGAsByState(state);
  if (available.length === 0) return data;

  const parts = splitSelectionInput(t);
  if (parts.length === 0) return data;

  const matched: string[] = [];
  for (const part of parts) {
    const norm = normalizeForMatch(part);
    if (!norm) continue;
    const exact = available.find((lga) => normalizeForMatch(lga) === norm);
    const partial = available.find((lga) => normalizeForMatch(lga).includes(norm));
    const pick = exact ?? partial;
    if (pick && !matched.some((x) => x.toLowerCase() === pick.toLowerCase())) matched.push(pick);
  }
  if (matched.length === 0) return data;

  const prev = loc.localGovernmentAreas ?? loc.lgas;
  const prevList = Array.isArray(prev) ? prev.map(String).map((s) => s.trim()).filter(Boolean) : [];
  const merged = [...prevList];
  for (const m of matched) {
    if (!merged.some((x) => x.toLowerCase() === m.toLowerCase())) merged.push(m);
  }

  return {
    ...data,
    location: {
      ...loc,
      localGovernmentAreas: merged,
    },
  };
}

/** Merge typed area reply using available areas under the selected LGA. */
export function mergeUserAreaReplyByOptions(
  data: Record<string, unknown>,
  userText: string
): Record<string, unknown> {
  const t = userText.trim();
  if (!t) return data;
  const loc = getLoc(data);
  if (!loc) return data;
  const state = String(loc.state ?? "").trim();
  const lgas = loc.localGovernmentAreas ?? loc.lgas;
  const lgaList = Array.isArray(lgas) ? lgas.map(String).map((s) => s.trim()).filter(Boolean) : [];
  if (!state || lgaList.length !== 1) return mergeUserAreaReplyIntoLocation(data, userText);

  const lga = lgaList[0];
  const availableAreas = getAreasByLGA(state, lga);
  if (availableAreas.length === 0) return mergeUserAreaReplyIntoLocation(data, userText);

  const parts = splitSelectionInput(t);
  const matched: string[] = [];
  for (const part of parts) {
    const norm = normalizeForMatch(part);
    if (!norm) continue;
    const exact = availableAreas.find((a) => normalizeForMatch(a) === norm);
    const partial = availableAreas.find((a) => normalizeForMatch(a).includes(norm));
    const pick = exact ?? partial;
    if (pick && !matched.some((x) => x.toLowerCase() === pick.toLowerCase())) matched.push(pick);
  }
  if (matched.length === 0) return mergeUserAreaReplyIntoLocation(data, userText);

  const next: Record<string, unknown> = { ...loc };
  const prevSel =
    next.selectedAreas && typeof next.selectedAreas === "object" && !Array.isArray(next.selectedAreas)
      ? { ...(next.selectedAreas as Record<string, unknown>) }
      : {};
  const existing = Array.isArray(prevSel[lga]) ? (prevSel[lga] as unknown[]).map(String) : [];
  const merged = [...existing];
  for (const area of matched) {
    if (!merged.some((x) => x.toLowerCase() === area.toLowerCase())) merged.push(area);
  }
  next.selectedAreas = { ...prevSel, [lga]: merged };

  return { ...data, location: next };
}

/** Build a dynamic location options hint for LGA/Area prompts. */
export function getLocationSelectionHint(
  id: ConversationFieldId,
  data: Record<string, unknown> | null | undefined
): string {
  if (!data || typeof data !== "object") return "";
  const loc = getLoc(data);
  if (!loc) return "";
  const state = String(loc.state ?? "").trim();
  if (!state) return "";

  if (id === "lga") {
    const lgas = getLGAsByState(state);
    if (lgas.length === 0) return "";
    return `Available LGAs in ${state}: ${lgas.join(", ")}. Reply with one (or up to 3 separated by commas).`;
  }
  if (id === "area") {
    const lgasRaw = loc.localGovernmentAreas ?? loc.lgas;
    const lgaList = Array.isArray(lgasRaw) ? lgasRaw.map(String).map((s) => s.trim()).filter(Boolean) : [];
    if (lgaList.length !== 1) return "";
    const lga = lgaList[0];
    const areas = getAreasByLGA(state, lga);
    if (areas.length === 0) return "";
    return `Available areas in ${lga}, ${state}: ${areas.join(", ")}. Reply with one or more separated by commas.`;
  }
  return "";
}

/** True if location has neighbourhoods / areas (form + API shapes). */
export function locationPayloadHasAreas(l: Record<string, unknown>): boolean {
  const sel = l.selectedAreas;
  if (Array.isArray(sel) && sel.some((x) => x != null && String(x).trim() !== "")) return true;
  if (sel && typeof sel === "object" && !Array.isArray(sel)) {
    for (const v of Object.values(sel)) {
      if (Array.isArray(v) && v.some((x) => x != null && String(x).trim() !== "")) return true;
      if (typeof v === "string" && String(v).trim() !== "") return true;
    }
  }
  const areas = l.areas;
  if (Array.isArray(areas) && areas.some((a) => String(a).trim() !== "")) return true;
  if (areas && typeof areas === "object" && !Array.isArray(areas)) {
    for (const v of Object.values(areas as Record<string, unknown>)) {
      if (Array.isArray(v) && v.some((x) => x != null && String(x).trim() !== "")) return true;
      if (typeof v === "string" && String(v).trim() !== "") return true;
    }
  }
  const custom = l.customLocation;
  if (typeof custom === "string" && custom.trim() !== "") return true;
  return false;
}

function getPd(data: Record<string, unknown>): Record<string, unknown> | null {
  const pd = data.propertyDetails;
  if (pd && typeof pd === "object" && !Array.isArray(pd)) return pd as Record<string, unknown>;
  return null;
}

function getDd(data: Record<string, unknown>): Record<string, unknown> | null {
  const dd = data.developmentDetails;
  if (dd && typeof dd === "object" && !Array.isArray(dd)) return dd as Record<string, unknown>;
  return null;
}

function getBd(data: Record<string, unknown>): Record<string, unknown> | null {
  const bd = data.bookingDetails;
  if (bd && typeof bd === "object" && !Array.isArray(bd)) return bd as Record<string, unknown>;
  return null;
}

function numOk(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return true;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/,/g, "").trim());
    return Number.isFinite(n) && n > 0;
  }
  return false;
}

function landSingleValue(pd: Record<string, unknown>): unknown {
  return pd.landSize ?? pd.land_size ?? pd.totalLandSize;
}

function minSqmValue(pd: Record<string, unknown>): unknown {
  return pd.minLandSize ?? pd.min_land_size;
}

function maxSqmValue(pd: Record<string, unknown>): unknown {
  return pd.maxLandSize ?? pd.max_land_size;
}

/** Parse a positive land size from one line (digits, commas, optional decimals). */
export function parsePositiveLandNumberFromText(text: string): number | null {
  const cleaned = text.trim().replace(/,/g, "").replace(/\s+/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export type LandSizeFocusId = "land_size_single" | "land_size_sqm_min" | "land_size_sqm_max";

/** Persist land size answers — API often omits or uses snake_case keys. */
export function mergeUserLandSizeReply(
  data: Record<string, unknown>,
  focus: LandSizeFocusId,
  userText: string
): Record<string, unknown> {
  const n = parsePositiveLandNumberFromText(userText);
  if (n == null) return data;
  const pd = getPd(data) || {};
  if (focus === "land_size_single") {
    return { ...data, propertyDetails: { ...pd, landSize: n } };
  }
  if (focus === "land_size_sqm_min") {
    return { ...data, propertyDetails: { ...pd, minLandSize: n } };
  }
  return { ...data, propertyDetails: { ...pd, maxLandSize: n } };
}

/** Copy snake_case / alternate land size keys into camelCase for form + validation. */
export function normalizePropertyDetailsLandSizeKeys(data: Record<string, unknown>): Record<string, unknown> {
  const pd = getPd(data);
  if (!pd) return data;
  const next: Record<string, unknown> = { ...pd };
  let changed = false;
  const coalesce = (primary: unknown, ...alts: unknown[]): number | null => {
    if (numOk(primary)) return null;
    for (const a of alts) {
      if (a === undefined || a === null) continue;
      const n = Number(String(a).replace(/,/g, "").trim());
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  };
  const ls = coalesce(next.landSize, next.land_size, next.totalLandSize);
  if (ls != null) {
    next.landSize = ls;
    changed = true;
  }
  const mn = coalesce(next.minLandSize, next.min_land_size);
  if (mn != null) {
    next.minLandSize = mn;
    changed = true;
  }
  const mx = coalesce(next.maxLandSize, next.max_land_size);
  if (mx != null) {
    next.maxLandSize = mx;
    changed = true;
  }
  return changed ? { ...data, propertyDetails: next } : data;
}

function bedroomsValue(pd: Record<string, unknown>): unknown {
  return pd.bedrooms ?? pd.minBedrooms ?? pd.numBedrooms ?? pd.bedroomCount ?? pd.numberOfBedrooms;
}

function bedroomsAnswerFilled(pd: Record<string, unknown>): boolean {
  const v = bedroomsValue(pd);
  if (v === undefined || v === null) return false;
  return String(v).trim() !== "";
}

/** Extract bedroom count for form (string; supports "More"). */
export function parseBedroomsFromUserText(text: string): string | null {
  const raw = text.trim().toLowerCase();
  if (!raw) return null;
  if (/\bmore\b/.test(raw) && !/\b([1-9]|1[0-9])\b/.test(raw)) return "More";
  const digitOnly = raw.match(/^(\d{1,2})$/);
  if (digitOnly) return digitOnly[1];
  const m = raw.match(/\b([1-9]|1[0-9])\s*(?:bed(?:room)?s?)?\b/);
  if (m) return m[1];
  const word: Record<string, string> = {
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
    ten: "10",
  };
  for (const [w, d] of Object.entries(word)) {
    if (new RegExp(`\\b${w}\\b`).test(raw)) return d;
  }
  return null;
}

export function mergeUserBedroomsReply(data: Record<string, unknown>, userText: string): Record<string, unknown> {
  const b = parseBedroomsFromUserText(userText);
  if (!b) return data;
  const pd = getPd(data) || {};
  return { ...data, propertyDetails: { ...pd, bedrooms: b } };
}

/** Promote minBedrooms / API aliases into bedrooms when the latter is empty. */
export function normalizePropertyDetailsBedroomFields(data: Record<string, unknown>): Record<string, unknown> {
  const pd = getPd(data);
  if (!pd) return data;
  if (bedroomsAnswerFilled(pd)) return data;
  const alt = pd.minBedrooms ?? pd.numBedrooms ?? pd.bedroomCount ?? pd.numberOfBedrooms;
  if (alt !== undefined && alt !== null && String(alt).trim() !== "") {
    return { ...data, propertyDetails: { ...pd, bedrooms: String(alt).trim() } };
  }
  return data;
}

function bathroomsValue(pd: Record<string, unknown>): unknown {
  return pd.bathrooms ?? pd.minBathrooms ?? pd.numBathrooms ?? pd.bathroomCount;
}

function bathroomsAnswerFilled(pd: Record<string, unknown>, pt: string): boolean {
  const v = bathroomsValue(pd);
  if (v === undefined || v === null) return false;
  if (pt === "shortlet") return Number(v) >= 1;
  return String(v).trim() !== "" && Number.isFinite(Number(v));
}

/** Persist bathroom count from user line (digits or words; "more than ten" → 11). */
export function mergeUserBathroomsReply(data: Record<string, unknown>, userText: string): Record<string, unknown> {
  const t = userText.trim().toLowerCase();
  if (!t) return data;
  let n: number | null = null;
  if (/\bmore\b/.test(t) && (/\bten\b|\b10\b/.test(t) || /\bthan\b/.test(t))) n = 11;
  else {
    const m = t.match(/\b(\d{1,2})\b/);
    if (m) n = parseInt(m[1], 10);
    else {
      const word: Record<string, number> = {
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
        ten: 10,
      };
      for (const [w, d] of Object.entries(word)) {
        if (new RegExp(`\\b${w}\\b`).test(t)) {
          n = d;
          break;
        }
      }
    }
  }
  if (n == null || n < 0) return data;
  const pd = getPd(data) || {};
  return { ...data, propertyDetails: { ...pd, bathrooms: n } };
}

export function normalizePropertyDetailsBathroomFields(data: Record<string, unknown>): Record<string, unknown> {
  const pd = getPd(data);
  if (!pd) return data;
  const pt = String(data.preferenceType ?? "").toLowerCase();
  if (bathroomsAnswerFilled(pd, pt)) return data;
  const alt = pd.minBathrooms ?? pd.numBathrooms ?? pd.bathroomCount;
  if (alt !== undefined && alt !== null && String(alt).trim() !== "") {
    const n = Number(String(alt).replace(/,/g, ""));
    if (Number.isFinite(n) && n >= 0) {
      return { ...data, propertyDetails: { ...pd, bathrooms: n } };
    }
  }
  return data;
}

function getFeaturesArrays(data: Record<string, unknown>): { basic: string[]; premium: string[] } {
  const f = data.features as Record<string, unknown> | undefined;
  if (!f || typeof f !== "object" || Array.isArray(f)) return { basic: [], premium: [] };
  const basicRaw = f.basicFeatures ?? f.baseFeatures;
  const premRaw = f.premiumFeatures;
  const basic = Array.isArray(basicRaw)
    ? basicRaw.map((x) => String(x).trim()).filter((s) => s !== "")
    : [];
  const premium = Array.isArray(premRaw)
    ? premRaw.map((x) => String(x).trim()).filter((s) => s !== "")
    : [];
  return { basic, premium };
}

/** Parse comma / "and"-separated amenity names into basic features (premium left empty unless clearly premium). */
export function mergeUserFeaturesReply(data: Record<string, unknown>, userText: string): Record<string, unknown> {
  const t = userText.trim().toLowerCase();
  const prevF = (data.features as Record<string, unknown>) || {};
  const autoAdj =
    typeof prevF.autoAdjustToBudget === "boolean"
      ? prevF.autoAdjustToBudget
      : typeof prevF.autoAdjustToFeatures === "boolean"
        ? prevF.autoAdjustToFeatures
        : false;
  if (t === "" || t === "none" || t === "no" || t === "n/a" || t === "nothing") {
    return {
      ...data,
      features: {
        basicFeatures: [],
        premiumFeatures: [],
        baseFeatures: [],
        autoAdjustToBudget: autoAdj,
        featuresDeclared: true,
      },
    };
  }
  const parts = userText
    .split(/[,;]|\band\b/gi)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length === 0) {
    return {
      ...data,
      features: {
        basicFeatures: [],
        premiumFeatures: [],
        baseFeatures: [],
        autoAdjustToBudget: autoAdj,
        featuresDeclared: true,
      },
    };
  }
  return {
    ...data,
    features: {
      ...prevF,
      basicFeatures: parts,
      baseFeatures: parts,
      premiumFeatures: Array.isArray(prevF.premiumFeatures) ? prevF.premiumFeatures : [],
      autoAdjustToBudget: autoAdj,
      featuresDeclared: true,
    },
  };
}

export function mergeUserCarParksReply(data: Record<string, unknown>, userText: string): Record<string, unknown> {
  const t = userText.trim().toLowerCase();
  const pd = getPd(data) || {};
  const m = t.match(/\b(\d{1,2})\b/);
  if (!m) return { ...data, propertyDetails: { ...pd } };
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 0 || n > 99) return { ...data, propertyDetails: { ...pd } };
  return { ...data, propertyDetails: { ...pd, noOfCarPark: n } };
}

export function mergeUserAdditionalNotesReply(data: Record<string, unknown>, userText: string): Record<string, unknown> {
  return { ...data, additionalNotes: userText.trim() };
}

const JV_DEV_TYPES = new Set(["residential", "commercial", "mixed-use", "industrial"]);

export function mergeUserJvDevelopmentTypesReply(
  data: Record<string, unknown>,
  userText: string
): Record<string, unknown> {
  const parts = userText
    .split(/[,;]|\band\b/gi)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const matched: string[] = [];
  for (const p of parts) {
    if (/\bresiden/.test(p)) matched.push("residential");
    else if (/\bcommerc/.test(p)) matched.push("commercial");
    else if (/\bmixed/.test(p)) matched.push("mixed-use");
    else if (/\bindustr/.test(p)) matched.push("industrial");
    else if (JV_DEV_TYPES.has(p)) matched.push(p);
  }
  if (matched.length === 0) return data;
  const dd = getDd(data) || {};
  const prev = Array.isArray(dd.developmentTypes) ? (dd.developmentTypes as string[]) : [];
  const merged = [...new Set([...prev, ...matched])];
  return { ...data, developmentDetails: { ...dd, developmentTypes: merged } };
}

export function mergeUserJvSharingRatioReply(
  data: Record<string, unknown>,
  userText: string
): Record<string, unknown> {
  const t = userText.trim();
  if (!t) return data;
  const dd = getDd(data) || {};
  return { ...data, developmentDetails: { ...dd, preferredSharingRatio: t } };
}

export function mergeUserJvTitleRequirementsReply(
  data: Record<string, unknown>,
  userText: string
): Record<string, unknown> {
  const parts = userText
    .split(/[,;]|\band\b/gi)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return data;
  const dd = getDd(data) || {};
  const prev = Array.isArray(dd.minimumTitleRequirements)
    ? (dd.minimumTitleRequirements as string[])
    : [];
  return {
    ...data,
    developmentDetails: { ...dd, minimumTitleRequirements: [...new Set([...prev, ...parts])] },
  };
}

export function mergeUserJvMinLandSizeReply(
  data: Record<string, unknown>,
  userText: string
): Record<string, unknown> {
  const n = parsePositiveLandNumberFromText(userText);
  if (n == null) return data;
  const dd = getDd(data) || {};
  return { ...data, developmentDetails: { ...dd, minLandSize: String(n) } };
}

export function mergeUserJvCompanyNameReply(
  data: Record<string, unknown>,
  userText: string
): Record<string, unknown> {
  const t = userText.trim();
  if (!t) return data;
  const ci = (data.contactInfo as Record<string, unknown>) || {};
  return { ...data, contactInfo: { ...ci, companyName: t, contactPerson: t } };
}

export function mergeUserOffPlanFieldsReply(
  data: Record<string, unknown>,
  focus:
    | "off_plan_completion_date"
    | "off_plan_development_stage"
    | "off_plan_payment_plan",
  userText: string
): Record<string, unknown> {
  const t = userText.trim();
  if (!t) return data;
  const pd = getPd(data) || {};
  if (focus === "off_plan_completion_date") {
    return { ...data, propertyDetails: { ...pd, expectedCompletionDate: t } };
  }
  if (focus === "off_plan_development_stage") {
    const stage = t.toLowerCase().replace(/\s+/g, "-");
    return { ...data, propertyDetails: { ...pd, developmentStage: stage } };
  }
  return { ...data, propertyDetails: { ...pd, paymentPlan: t.toLowerCase().replace(/\s+/g, "-") } };
}

export { parseNigerianPhoneFromText };

function budgetMinOk(data: Record<string, unknown>): boolean {
  const b = data.budget;
  if (!b || typeof b !== "object" || Array.isArray(b)) return false;
  return numOk((b as Record<string, unknown>).minPrice);
}

function budgetMaxOk(data: Record<string, unknown>): boolean {
  const b = data.budget;
  if (!b || typeof b !== "object" || Array.isArray(b)) return false;
  const max = (b as Record<string, unknown>).maxPrice;
  const min = (b as Record<string, unknown>).minPrice;
  if (!numOk(max)) return false;
  const maxN = typeof max === "number" ? max : Number(String(max).replace(/,/g, ""));
  const minN = min === undefined || min === null ? 0 : typeof min === "number" ? min : Number(String(min).replace(/,/g, ""));
  return maxN > minN;
}

function phoneOk(data: Record<string, unknown>): boolean {
  const c = data.contactInfo;
  if (!c || typeof c !== "object" || Array.isArray(c)) return false;
  const p = String((c as Record<string, unknown>).phoneNumber ?? "").trim();
  return normalizeNigerianPhoneNumber(p) !== null;
}

function arrMin1(v: unknown): boolean {
  return Array.isArray(v) && v.some((x) => x != null && String(x).trim() !== "");
}

function normSubtype(pd: Record<string, unknown>): string {
  return String(pd.propertySubtype ?? pd.propertyType ?? "").toLowerCase().trim();
}

/** Map voice/typo variants to canonical form values (plot | sqm | acres). */
export function parseMeasurementUnitFromUserText(text: string): "plot" | "sqm" | "acres" | null {
  const raw = text.trim().toLowerCase();
  if (!raw) return null;
  const t = raw.replace(/\s+/g, " ");
  if (/\bplots?\b/.test(t) && !/\bsqm\b|\bsquare\b/.test(t)) return "plot";
  if (/\bsqm\b|\bsquare\s*met(er|re)s?\b|\bm\s*2\b|\bm²\b/.test(t)) return "sqm";
  if (/\bhectares?\b/.test(t)) return "acres";
  if (/\bacres?\b|\bacares\b/.test(t)) return "acres";
  if (t === "plot" || t === "plots") return "plot";
  if (t === "sqm" || t === "square") return "sqm";
  if (t === "acres" || t === "acre" || t === "acares") return "acres";
  return null;
}

function measurementUnitNorm(pd: Record<string, unknown>): string {
  const raw = pd.measurementUnit ?? pd.measurement_unit;
  let u = String(raw ?? "")
    .toLowerCase()
    .trim();
  const parsed = u ? parseMeasurementUnitFromUserText(u) : null;
  if (parsed) return parsed;
  if (u === "hectares" || u === "hectare") return "acres";
  return u;
}

/**
 * When answering the measurement-unit step, persist the user line into propertyDetails or developmentDetails
 * (same idea as mergeUserAreaReplyIntoLocation — API often omits or blanks this field).
 */
export function mergeUserMeasurementUnitReply(
  data: Record<string, unknown>,
  focus: "measurement_unit" | "jv_measurement_unit",
  userText: string
): Record<string, unknown> {
  const unit = parseMeasurementUnitFromUserText(userText);
  if (!unit) return data;
  if (focus === "jv_measurement_unit") {
    const dd = getDd(data) || {};
    return { ...data, developmentDetails: { ...dd, measurementUnit: unit } };
  }
  const pd = getPd(data) || {};
  return { ...data, propertyDetails: { ...pd, measurementUnit: unit } };
}

export function normalizePreferenceDataMeasurementUnits(data: Record<string, unknown>): Record<string, unknown> {
  let out: Record<string, unknown> = { ...data };
  const pd = getPd(out);
  if (pd) {
    const u = measurementUnitNorm(pd);
    if (u && u !== pd.measurementUnit) {
      out = { ...out, propertyDetails: { ...pd, measurementUnit: u } };
    }
  }
  const dd = getDd(out);
  if (dd) {
    const raw = dd.measurementUnit ?? dd.measurement_unit;
    const uNorm = measurementUnitNorm({
      measurementUnit: raw,
      measurement_unit: raw,
    } as Record<string, unknown>);
    if (uNorm && ["plot", "sqm", "acres"].includes(uNorm) && uNorm !== String(dd.measurementUnit ?? "").toLowerCase()) {
      out = { ...out, developmentDetails: { ...dd, measurementUnit: uNorm } };
    }
  }
  return out;
}

/** Parse opening utterance for Buy / Rent / JV / Shortlet / Off-Plan. */
export function parsePreferenceTypeFromStart(text: string): NormalizedPreferenceType | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  if (/\boff[\s-]?plan\b/.test(t)) return "off-plan";
  if (/\bjoint\s+venture\b|\bjv\b|\bj\.v\.?\b/.test(t)) return "joint-venture";
  if (/\bshort[\s-]?let\b/.test(t)) return "shortlet";
  if (/\brent(al|ing)?\b|\blease\b|\btenant\b/.test(t)) return "rent";
  if (/\bbuy\b|\bpurchase\b|\boutright\b|\bfor sale preference\b/.test(t)) return "buy";
  if (/^rent$/i.test(text.trim())) return "rent";
  if (/^buy$/i.test(text.trim())) return "buy";
  return null;
}

function isMeaningfulValue(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return Number.isFinite(v);
  if (Array.isArray(v)) return v.length > 0;
  return false;
}

/** Apply "Lagos, Ikeja, Lekki" style location from free text when fields are still empty. */
export function applyLocationFromNaturalText(
  data: Record<string, unknown>,
  text: string
): Record<string, unknown> {
  const raw = text.trim();
  if (!raw) return data;
  const loc = getLoc(data) || {};
  const hasState = isMeaningfulValue(loc.state);
  const lgasRaw = loc.localGovernmentAreas ?? loc.lgas;
  const hasLga = Array.isArray(lgasRaw) && lgasRaw.some((x) => String(x).trim());
  const hasArea = locationPayloadHasAreas(loc);

  const parts = raw.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return data;

  const next: Record<string, unknown> = { ...loc };
  if (parts.length >= 3 && !hasState) {
    next.state = parts[0];
    next.localGovernmentAreas = [parts[1]];
    next.selectedAreas = mergeSelectedAreasMaps(next.selectedAreas, { [parts[1]]: [parts.slice(2).join(", ")] });
    return { ...data, location: mergeLocationPayload(getLoc(data) ?? undefined, next) };
  }
  if (parts.length === 2) {
    if (!hasState) {
      next.state = parts[0];
      next.localGovernmentAreas = [parts[1]];
      return { ...data, location: mergeLocationPayload(getLoc(data) ?? undefined, next) };
    }
    if (!hasLga) {
      next.localGovernmentAreas = [parts[0]];
      return {
        ...data,
        location: mergeLocationPayload(getLoc(data) ?? undefined, {
          ...next,
          selectedAreas: mergeSelectedAreasMaps(next.selectedAreas, { [parts[0]]: [parts[1]] }),
        }),
      };
    }
    if (!hasArea) {
      const lgaList = Array.isArray(next.localGovernmentAreas)
        ? (next.localGovernmentAreas as string[]).map(String)
        : [];
      const lga = lgaList[0] || parts[0];
      return {
        ...data,
        location: mergeLocationPayload(getLoc(data) ?? undefined, {
          ...next,
          selectedAreas: mergeSelectedAreasMaps(next.selectedAreas, { [lga]: [parts.join(", ")] }),
        }),
      };
    }
  }
  if (parts.length === 1) {
    const v = parts[0];
    if (!hasState) return { ...data, location: mergeLocationPayload(getLoc(data) ?? undefined, { ...next, state: v }) };
    if (!hasLga) {
      return {
        ...data,
        location: mergeLocationPayload(getLoc(data) ?? undefined, { ...next, localGovernmentAreas: [v] }),
      };
    }
    if (!hasArea) {
      const lgaList = Array.isArray(next.localGovernmentAreas)
        ? (next.localGovernmentAreas as string[]).map(String)
        : [];
      const lga = lgaList[0];
      if (lga) {
        return {
          ...data,
          location: mergeLocationPayload(getLoc(data) ?? undefined, {
            ...next,
            selectedAreas: mergeSelectedAreasMaps(next.selectedAreas, { [lga]: [v] }),
          }),
        };
      }
    }
  }
  return data;
}

function parsePropertySubtypeFromText(text: string): "land" | "residential" | "commercial" | null {
  const t = text.toLowerCase();
  if (/\bland\b/.test(t) && !/\bisland\b/.test(t)) return "land";
  if (/\bresiden/i.test(t)) return "residential";
  if (/\bcommerc/i.test(t)) return "commercial";
  return null;
}

function extractAllNairaAmountsFromText(text: string): number[] {
  const amounts: number[] = [];
  const re = /(?:₦|naira\s*)?(\d[\d,\s]*(?:\.\d+)?)\s*(k|m|million|b|billion|thousand)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const base = parseFloat(m[1].replace(/[\s,]/g, ""));
    if (!Number.isFinite(base) || base <= 0) continue;
    const suf = m[2]?.toLowerCase();
    let mult = 1;
    if (suf === "k" || suf === "thousand") mult = 1_000;
    else if (suf === "m" || suf === "million") mult = 1_000_000;
    else if (suf === "b" || suf === "billion") mult = 1_000_000_000;
    amounts.push(Math.round(base * mult));
  }
  const fromWords = parseNairaAmountFromText(text);
  if (fromWords != null && fromWords > 0) amounts.push(fromWords);
  return [...new Set(amounts)].filter((n) => n > 0);
}

/**
 * Parse a long user statement and fill every still-missing field we can detect locally
 * (before / after the suggest-preference API). Complements API extraction on opening turns.
 */
export function applyBulkExtractFromUserText(
  data: Record<string, unknown>,
  userText: string,
  accumulatedText?: string
): Record<string, unknown> {
  const text = userText.trim();
  const full = (accumulatedText || text).trim();
  if (!text && !full) return data;

  let d = { ...data };
  const useFull = isLongMultiFieldUtterance(full) ? full : text;

  const pt = parsePreferenceTypeFromStart(text) || parsePreferenceTypeFromStart(full);
  if (pt && isMissingPreferenceType(d)) {
    d = { ...d, preferenceType: pt };
  }

  if (isLongMultiFieldUtterance(useFull)) {
    d = applyLocationFromNaturalText(d, useFull);

    const subtype = parsePropertySubtypeFromText(useFull);
    if (subtype) {
      const pd = getPd(d) || {};
      if (!normSubtype(pd)) {
        d = { ...d, propertyDetails: { ...pd, propertySubtype: subtype, propertyType: subtype } };
      }
    }

    const bedrooms = parseBedroomsFromUserText(useFull);
    if (bedrooms) {
      const pd = getPd(d) || {};
      if (!bedroomsAnswerFilled(pd)) {
        d = mergeUserBedroomsReply(d, useFull);
      }
    }

    const amounts = extractAllNairaAmountsFromText(useFull);
    if (amounts.length >= 2) {
      const sorted = [...amounts].sort((a, b) => a - b);
      if (!budgetMinOk(d)) d = applyBudgetToData(d, "min_budget", sorted[0]);
      if (!budgetMaxOk(d)) d = applyBudgetToData(d, "max_budget", sorted[sorted.length - 1]);
    } else if (amounts.length === 1) {
      if (!budgetMinOk(d) && !budgetMaxOk(d)) {
        d = applyBudgetToData(d, "min_budget", amounts[0]);
        d = applyBudgetToData(d, "max_budget", amounts[0]);
      } else if (!budgetMaxOk(d)) {
        d = applyBudgetToData(d, "max_budget", amounts[0]);
      } else if (!budgetMinOk(d)) {
        d = applyBudgetToData(d, "min_budget", amounts[0]);
      }
    }

    const unit = parseMeasurementUnitFromUserText(useFull);
    if (unit) {
      const pd = getPd(d) || {};
      if (!measurementUnitNorm(pd)) {
        d = mergeUserMeasurementUnitReply(d, "measurement_unit", unit);
      }
    }
  }

  return d;
}

/**
 * Prevent partial API merges from wiping fields already collected (stops repeat prompts).
 */
export function keepCollectedDataProgress(
  previous: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>
): Record<string, unknown> {
  if (!previous || typeof previous !== "object") return next;
  let out = { ...next };

  const prevLoc = getLoc(previous);
  const nextLoc = getLoc(out);
  if (prevLoc && nextLoc) {
    const prevState = String(prevLoc.state ?? "").trim();
    const nextState = String(nextLoc.state ?? "").trim();
    const prevLgas = Array.isArray(prevLoc.localGovernmentAreas)
      ? (prevLoc.localGovernmentAreas as string[]).filter((x) => String(x).trim())
      : [];
    const nextLgas = Array.isArray(nextLoc.localGovernmentAreas)
      ? (nextLoc.localGovernmentAreas as string[]).filter((x) => String(x).trim())
      : [];
    const prevHasAreas = locationPayloadHasAreas(prevLoc);
    const nextHasAreas = locationPayloadHasAreas(nextLoc);

    if (prevState && !nextState) {
      out = { ...out, location: mergeLocationPayload(nextLoc, { state: prevState }) };
    } else if (prevLgas.length > 0 && nextLgas.length === 0) {
      out = {
        ...out,
        location: mergeLocationPayload(getLoc(out) ?? undefined, { localGovernmentAreas: prevLgas }),
      };
    } else if (prevHasAreas && !nextHasAreas) {
      out = {
        ...out,
        location: mergeLocationPayload(getLoc(out) ?? undefined, {
          selectedAreas: prevLoc.selectedAreas,
          customLocation: prevLoc.customLocation,
        }),
      };
    }
  }

  const prevPd = getPd(previous);
  const nextPd = getPd(out);
  if (prevPd && nextPd) {
    const mergedPd: Record<string, unknown> = { ...(nextPd as Record<string, unknown>) };
    const carry = (key: string) => {
      const p = (prevPd as Record<string, unknown>)[key];
      const n = mergedPd[key];
      if (isMeaningfulValue(p) && !isMeaningfulValue(n)) mergedPd[key] = p;
    };
    [
      "propertySubtype",
      "propertyType",
      "measurementUnit",
      "landSize",
      "minLandSize",
      "maxLandSize",
      "documentTypes",
      "propertyCondition",
      "buildingType",
      "bedrooms",
      "minBedrooms",
      "bathrooms",
      "leaseTerm",
      "purpose",
      "maxGuests",
      "travelType",
      "noOfCarPark",
    ].forEach(carry);
    out = { ...out, propertyDetails: mergedPd };
  }

  const prevBudget = previous.budget as Record<string, unknown> | undefined;
  const nextBudget = out.budget as Record<string, unknown> | undefined;
  if (prevBudget && nextBudget) {
    const b = { ...nextBudget };
    if (numOk(prevBudget.minPrice) && !numOk(b.minPrice)) b.minPrice = prevBudget.minPrice;
    if (numOk(prevBudget.maxPrice) && !numOk(b.maxPrice)) b.maxPrice = prevBudget.maxPrice;
    out = { ...out, budget: b };
  }

  if (isMeaningfulValue(previous.preferenceType) && !isMeaningfulValue(out.preferenceType)) {
    out = { ...out, preferenceType: previous.preferenceType };
  }

  return out;
}

const WORD_NUM: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
};

function parseEnglishMagnitudeChunk(s: string): number | null {
  const parts = s
    .toLowerCase()
    .replace(/-/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return null;
  let total = 0;
  let current = 0;
  for (const w of parts) {
    const n = WORD_NUM[w];
    if (n === undefined) return null;
    if (n === 100) {
      current = (current || 1) * 100;
    } else if (n >= 20) {
      current += n;
    } else {
      current += n;
    }
  }
  total += current;
  return total;
}

/**
 * Parse min/max budget from voice or typed text. Returns integer Naira amount or null.
 */
export function parseNairaAmountFromText(text: string): number | null {
  if (!text || typeof text !== "string") return null;
  let t = text.toLowerCase().replace(/₦|naira/gi, "").replace(/,/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;

  const digitMatch = t.match(/(\d[\d\s,]*)(?:\.(\d+))?\s*(k|m|million|b|billion|thousand)?/i);
  if (digitMatch) {
    const base = parseFloat(digitMatch[1].replace(/[\s,]/g, ""));
    if (!Number.isFinite(base)) return null;
    const suf = digitMatch[3]?.toLowerCase();
    let mult = 1;
    if (suf === "k" || suf === "thousand") mult = 1_000;
    else if (suf === "m" || suf === "million") mult = 1_000_000;
    else if (suf === "b" || suf === "billion") mult = 1_000_000_000;
    return Math.round(base * mult);
  }

  const wm = t.match(
    /([a-z\s-]+)\s+(thousand|k|million|m|billion|b)\b/i
  );
  if (wm) {
    const chunk = parseEnglishMagnitudeChunk(wm[1].replace(/\s+and\s+/g, " "));
    if (chunk == null || chunk < 0) return null;
    const suf = wm[2].toLowerCase();
    let mult = 1;
    if (suf === "k" || suf === "thousand") mult = 1_000;
    else if (suf === "m" || suf === "million") mult = 1_000_000;
    else if (suf === "b" || suf === "billion") mult = 1_000_000_000;
    return Math.round(chunk * mult);
  }

  const plainWords = parseEnglishMagnitudeChunk(t.replace(/\s+and\s+/g, " "));
  if (plainWords != null && plainWords > 0 && plainWords < 1000) {
    return null;
  }
  return null;
}

export function formatNairaWithCommas(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return "";
  return Math.round(amount).toLocaleString("en-US");
}

/** Keep only digits for incremental typing; returns display string with commas. */
export function formatNairaInputDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return BigInt(digits).toLocaleString("en-US");
}

export function parseDisplayNairaToNumber(display: string): number | null {
  const digits = display.replace(/\D/g, "");
  if (!digits) return null;
  try {
    const n = Number(BigInt(digits));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function applyBudgetToData(
  data: Record<string, unknown>,
  field: "min_budget" | "max_budget",
  amount: number
): Record<string, unknown> {
  const prev = data.budget;
  const b: Record<string, unknown> =
    prev && typeof prev === "object" && !Array.isArray(prev)
      ? { ...(prev as Record<string, unknown>) }
      : { currency: "NGN" };
  if (field === "min_budget") {
    b.minPrice = amount;
    if (b.maxPrice === undefined || b.maxPrice === null || b.maxPrice === "")
      b.maxPrice = amount;
  } else {
    b.maxPrice = amount;
    if (b.minPrice === undefined || b.minPrice === null || b.minPrice === "")
      b.minPrice = amount;
  }
  return { ...data, budget: b };
}

function isMissingPreferenceType(data: Record<string, unknown>): boolean {
  const p = String(data.preferenceType ?? "").trim().toLowerCase();
  return !["buy", "rent", "joint-venture", "shortlet", "off-plan"].includes(p);
}

function isMissingState(data: Record<string, unknown>): boolean {
  const l = getLoc(data);
  if (!l) return true;
  return !l.state || String(l.state).trim() === "";
}

function isMissingLga(data: Record<string, unknown>): boolean {
  const l = getLoc(data);
  if (!l) return true;
  const lgas = l.localGovernmentAreas ?? l.lgas;
  return !Array.isArray(lgas) || !lgas.some((x) => x != null && String(x).trim() !== "");
}

function isMissingArea(data: Record<string, unknown>): boolean {
  const l = getLoc(data);
  if (!l) return true;
  return !locationPayloadHasAreas(l);
}

function isConversationFieldMissing(data: Record<string, unknown>, id: ConversationFieldId): boolean {
  const pt = String(data.preferenceType ?? "").toLowerCase() as NormalizedPreferenceType | string;
  const pd = getPd(data);
  const dd = getDd(data);
  const bd = getBd(data);

  switch (id) {
    case "preference_type":
      return isMissingPreferenceType(data);
    case "state":
      return isMissingState(data);
    case "lga":
      return isMissingLga(data);
    case "area":
      return isMissingArea(data);
    case "property_subtype":
      if (pt === "shortlet") return false;
      if (pt === "buy" || pt === "rent" || pt === "off-plan") {
        if (!pd) return true;
        const st = normSubtype(pd);
        if (pt === "buy" || pt === "off-plan") return !["land", "residential", "commercial"].includes(st);
        return !["residential", "commercial"].includes(st);
      }
      return false;
    case "measurement_unit":
      if (pt !== "buy" && pt !== "rent" && pt !== "off-plan") return false;
      if (!pd) return true;
      return !measurementUnitNorm(pd);
    case "land_size_single":
      if (pt !== "buy" && pt !== "rent" && pt !== "off-plan") return false;
      if (!pd) return true;
      if (measurementUnitNorm(pd) === "sqm") return false;
      return !numOk(landSingleValue(pd));
    case "land_size_sqm_min":
      if (pt !== "buy" && pt !== "rent" && pt !== "off-plan") return false;
      if (!pd) return true;
      if (measurementUnitNorm(pd) !== "sqm") return false;
      return !numOk(minSqmValue(pd));
    case "land_size_sqm_max":
      if (pt !== "buy" && pt !== "rent" && pt !== "off-plan") return false;
      if (!pd) return true;
      if (measurementUnitNorm(pd) !== "sqm") return false;
      if (!numOk(minSqmValue(pd)) || !numOk(maxSqmValue(pd))) return true;
      const min =
        typeof minSqmValue(pd) === "number"
          ? (minSqmValue(pd) as number)
          : Number(String(minSqmValue(pd)).replace(/,/g, ""));
      const max =
        typeof maxSqmValue(pd) === "number"
          ? (maxSqmValue(pd) as number)
          : Number(String(maxSqmValue(pd)).replace(/,/g, ""));
      return !(max > min);
    case "document_types":
      if (pt !== "buy" && pt !== "off-plan") return false;
      if (!pd) return true;
      return !arrMin1(pd.documentTypes);
    case "land_conditions":
      if (pt !== "buy" && pt !== "off-plan") return false;
      if (!pd) return true;
      if (normSubtype(pd) !== "land") return false;
      return !arrMin1(pd.landConditions);
    case "property_condition":
      if (pt === "shortlet") return false;
      if (pt !== "buy" && pt !== "rent" && pt !== "off-plan") return false;
      if (!pd) return true;
      if (normSubtype(pd) === "land") return false;
      return !String(pd.propertyCondition ?? "").trim();
    case "building_type":
      if (pt === "shortlet") return false;
      if (pt !== "buy" && pt !== "rent" && pt !== "off-plan") return false;
      if (!pd) return true;
      if (normSubtype(pd) === "land") return false;
      return !String(pd.buildingType ?? "").trim();
    case "bedrooms":
      if (!pd) return true;
      if (pt === "shortlet") return !bedroomsAnswerFilled(pd);
      if (pt === "buy" || pt === "rent" || pt === "off-plan") {
        if (normSubtype(pd) !== "residential") return false;
        return !bedroomsAnswerFilled(pd);
      }
      return false;
    case "bathrooms":
      if (!pd) return true;
      if (pt === "shortlet") {
        return !bathroomsAnswerFilled(pd, pt);
      }
      if (pt === "buy" || pt === "off-plan") {
        const st = normSubtype(pd);
        if (st !== "residential" && st !== "commercial") return false;
        return !bathroomsAnswerFilled(pd, pt);
      }
      if (pt === "rent") {
        return !bathroomsAnswerFilled(pd, pt);
      }
      return false;
    case "lease_term":
      if (pt !== "rent") return false;
      if (!pd) return true;
      return !String(pd.leaseTerm ?? "").trim();
    case "purpose":
      if (pt !== "rent") return false;
      if (!pd) return true;
      return !String(pd.purpose ?? "").trim();
    case "min_budget":
      return !budgetMinOk(data);
    case "max_budget":
      return !budgetMaxOk(data);
    case "phone":
      return !phoneOk(data);
    case "shortlet_property_type":
      if (pt !== "shortlet") return false;
      if (!pd) return true;
      return !String(pd.propertyType ?? pd.propertySubtype ?? "").trim();
    case "shortlet_guests":
      if (pt !== "shortlet") return false;
      if (!pd) return true;
      return !numOk(pd.maxGuests);
    case "travel_type":
      if (pt !== "shortlet") return false;
      if (!pd) return true;
      return !String(pd.travelType ?? "").trim();
    case "check_in":
      if (pt !== "shortlet") return false;
      if (!bd) return true;
      return !String(bd.checkInDate ?? "").trim();
    case "check_out":
      if (pt !== "shortlet") return false;
      if (!bd) return true;
      return !String(bd.checkOutDate ?? "").trim();
    case "jv_measurement_unit":
      if (pt !== "joint-venture") return false;
      if (!dd) return true;
      return !measurementUnitNorm({
        measurementUnit: dd.measurementUnit ?? dd.measurement_unit,
        measurement_unit: dd.measurement_unit,
      } as Record<string, unknown>);
    case "jv_min_land_size":
      if (pt !== "joint-venture") return false;
      if (!dd) return true;
      return !String(dd.minLandSize ?? "").trim();
    case "jv_development_types":
      if (pt !== "joint-venture") return false;
      if (!dd) return true;
      return !arrMin1(dd.developmentTypes);
    case "jv_sharing_ratio":
      if (pt !== "joint-venture") return false;
      if (!dd) return true;
      return !String(dd.preferredSharingRatio ?? "").trim();
    case "jv_title_requirements":
      if (pt !== "joint-venture") return false;
      if (!dd) return true;
      return !arrMin1(dd.minimumTitleRequirements);
    case "jv_company_name": {
      if (pt !== "joint-venture") return false;
      const c = data.contactInfo as Record<string, unknown> | undefined;
      if (!c) return true;
      const name = String(c.companyName ?? c.fullName ?? "").trim();
      return name.length < 2;
    }
    case "off_plan_completion_date":
      if (pt !== "off-plan") return false;
      if (!pd) return true;
      return !String(pd.expectedCompletionDate ?? "").trim();
    case "off_plan_development_stage":
      if (pt !== "off-plan") return false;
      if (!pd) return true;
      return !String(pd.developmentStage ?? "").trim();
    case "off_plan_payment_plan":
      if (pt !== "off-plan") return false;
      if (!pd) return true;
      return !String(pd.paymentPlan ?? "").trim();
    case "features": {
      if (pt !== "buy" && pt !== "rent" && pt !== "joint-venture" && pt !== "shortlet" && pt !== "off-plan") return false;
      const f = data.features as Record<string, unknown> | undefined;
      if (f?.featuresDeclared === true) return false;
      const { basic, premium } = getFeaturesArrays(data);
      return basic.length === 0 && premium.length === 0;
    }
    case "car_parks": {
      if (pt !== "buy" && pt !== "rent" && pt !== "off-plan") return false;
      if (!pd) return true;
      if (normSubtype(pd) === "land") return false;
      const cp = pd.noOfCarPark;
      if (cp === undefined || cp === null) return true;
      if (typeof cp === "number" && Number.isFinite(cp)) return false;
      if (typeof cp === "string" && String(cp).trim() !== "") return false;
      return true;
    }
    case "additional_notes":
      if (pt !== "buy" && pt !== "rent" && pt !== "shortlet" && pt !== "off-plan") return false;
      return !String(data.additionalNotes ?? "").trim();
    default:
      return false;
  }
}

export function getBaseConversationOrder(pt: NormalizedPreferenceType): ConversationFieldId[] {
  return baseOrderForType(pt);
}

function baseOrderForType(pt: NormalizedPreferenceType): ConversationFieldId[] {
  switch (pt) {
    case "buy":
      return [
        "preference_type",
        "state",
        "lga",
        "area",
        "property_subtype",
        "measurement_unit",
        "land_size_single",
        "land_size_sqm_min",
        "land_size_sqm_max",
        "document_types",
        "land_conditions",
        "property_condition",
        "building_type",
        "bedrooms",
        "bathrooms",
        "min_budget",
        "max_budget",
        "features",
        "car_parks",
        "additional_notes",
        "phone",
      ];
    case "rent":
      return [
        "preference_type",
        "state",
        "lga",
        "area",
        "property_subtype",
        "measurement_unit",
        "land_size_single",
        "land_size_sqm_min",
        "land_size_sqm_max",
        "building_type",
        "property_condition",
        "bedrooms",
        "bathrooms",
        "lease_term",
        "purpose",
        "min_budget",
        "max_budget",
        "features",
        "car_parks",
        "additional_notes",
        "phone",
      ];
    case "shortlet":
      return [
        "preference_type",
        "state",
        "lga",
        "area",
        "shortlet_property_type",
        "bedrooms",
        "bathrooms",
        "shortlet_guests",
        "travel_type",
        "check_in",
        "check_out",
        "min_budget",
        "max_budget",
        "features",
        "additional_notes",
        "phone",
      ];
    case "joint-venture":
      return [
        "preference_type",
        "state",
        "lga",
        "area",
        "jv_development_types",
        "jv_measurement_unit",
        "jv_min_land_size",
        "jv_sharing_ratio",
        "jv_title_requirements",
        "jv_company_name",
        "phone",
      ];
    case "off-plan":
      return [
        "preference_type",
        "state",
        "lga",
        "area",
        "property_subtype",
        "measurement_unit",
        "land_size_single",
        "land_size_sqm_min",
        "land_size_sqm_max",
        "document_types",
        "land_conditions",
        "property_condition",
        "building_type",
        "bedrooms",
        "bathrooms",
        "off_plan_completion_date",
        "off_plan_development_stage",
        "off_plan_payment_plan",
        "min_budget",
        "max_budget",
        "features",
        "car_parks",
        "additional_notes",
        "phone",
      ];
    default:
      return ["preference_type", "state", "lga", "area", "phone"];
  }
}

/** Ordered list of conversation fields still required, excluding skipped ids. */
export function getOrderedMissingConversationFields(
  data: Record<string, unknown> | null | undefined,
  skipped: Iterable<ConversationFieldId>
): ConversationFieldId[] {
  const skipSet = new Set(skipped);
  if (!data || typeof data !== "object") {
    return (["preference_type"] as const).filter((id) => !skipSet.has(id)) as ConversationFieldId[];
  }
  if (isMissingPreferenceType(data)) {
    return (["preference_type"] as const).filter((id) => !skipSet.has(id)) as ConversationFieldId[];
  }
  const ptRaw = String(data.preferenceType ?? "").toLowerCase();
  const pt = (
    ["buy", "rent", "joint-venture", "shortlet", "off-plan"].includes(ptRaw) ? ptRaw : "buy"
  ) as NormalizedPreferenceType;
  const order = baseOrderForType(pt);
  const out: ConversationFieldId[] = [];
  for (const id of order) {
    if (skipSet.has(id)) continue;
    if (isConversationFieldMissing(data, id)) out.push(id);
  }
  return out;
}

export function getConversationFieldSpeakPrompt(
  id: ConversationFieldId,
  preferenceType?: string
): string {
  const pt = (preferenceType ?? "").toLowerCase();
  const lines = getConversationFieldDisplayLines(id, pt, 0);
  return prepareTextForNaturalSpeech(lines.speech);
}

type DisplayLines = { screen: string; speech: string };

function suffixRemaining(n: number): string {
  if (n <= 0) return "";
  if (n === 1) return " 1 more item after this (or say skip).";
  return ` ${n} more items after this (or say skip).`;
}

function getConversationFieldDisplayLines(
  id: ConversationFieldId,
  preferenceType: string,
  remainingAfterThis: number
): DisplayLines {
  const suf = suffixRemaining(remainingAfterThis);
  const pt = preferenceType.toLowerCase();

  switch (id) {
    case "preference_type":
      return {
        screen: `Start by saying your preference type: Buy, Rent, JV (joint venture), Shortlet, or Off-Plan. (format: buy)${suf}`,
        speech: "Say whether this is buy, rent, joint venture, shortlet, or off-plan.",
      };
    case "state":
      return {
        screen: `Which Nigerian state? (format: Lagos)${suf}`,
        speech: "Which Nigerian state?",
      };
    case "lga":
      return {
        screen: `Which local government area (LGA)? (format: Ikeja)${suf}`,
        speech: "Which local government area?",
      };
    case "area":
      return {
        screen: `Which area or neighbourhood within that LGA? (format: Lekki Phase 1)${suf}`,
        speech: "Which area or neighbourhood?",
      };
    case "property_subtype":
      if (pt === "rent") {
        return {
          screen: `Property subtype for rent: residential or commercial — then we’ll ask for building type (e.g. flat, bungalow). (format: residential)${suf}`,
          speech: "Is the rent preference residential or commercial?",
        };
      }
      return {
        screen: `Property subtype: land, residential, or commercial. (format: residential)${suf}`,
        speech: "Is it land, residential, or commercial?",
      };
    case "measurement_unit":
      return {
        screen: `Measurement unit for land size: plot, sqm, hectares, or acres? (format: plot)${suf}`,
        speech: "Which unit for land size: plot, square metres, hectares, or acres?",
      };
    case "land_size_single":
      return {
        screen: `Total land size in that unit? (format: 500)${suf}`,
        speech: "What is the total land size in that unit?",
      };
    case "land_size_sqm_min":
      return {
        screen: `Minimum land size in square metres (sqm)? (format: 300)${suf}`,
        speech: "What is the minimum land size in square metres?",
      };
    case "land_size_sqm_max":
      return {
        screen: `Maximum land size in square metres (sqm)? (format: 900)${suf}`,
        speech: "What is the maximum land size in square metres?",
      };
    case "document_types":
      return {
        screen: `Which documents do you need? (format: C of O)${suf}`,
        speech: "Which documents do you need?",
      };
    case "land_conditions":
      return {
        screen: `What land conditions apply? (format: dry land)${suf}`,
        speech: "What land conditions should we note?",
      };
    case "property_condition":
      return {
        screen: `What condition? (format: new)${suf}`,
        speech: "What property condition?",
      };
    case "building_type":
      return {
        screen: `What type of building? (format: duplex)${suf}`,
        speech: "What type of building?",
      };
    case "bedrooms":
      return {
        screen: `How many bedrooms? (format: 3)${suf}`,
        speech: "How many bedrooms?",
      };
    case "bathrooms":
      return {
        screen: `How many bathrooms? Say 1 to 10, or more for more than ten. (format: 2)${suf}`,
        speech: "How many bathrooms?",
      };
    case "lease_term":
      return {
        screen: `Preferred lease term? (format: 1 Year)${suf}`,
        speech: "What lease term do you prefer?",
      };
    case "purpose":
      return {
        screen: `Purpose: residential or office? (format: Residential)${suf}`,
        speech: "Is the purpose residential or office?",
      };
    case "min_budget":
      return {
        screen: `What's your minimum budget in Naira? Use comma-separated digits, e.g. 20,000,000. (format: 15,000,000)${suf}`,
        speech: "What is your minimum budget in Naira?",
      };
    case "max_budget":
      return {
        screen: `What's your maximum budget in Naira? Use commas, e.g. 50,000,000. (format: 50,000,000)${suf}`,
        speech: "What is your maximum budget in Naira?",
      };
    case "phone":
      return {
        screen: `What is your Nigerian phone number? (format: 08031234567)${suf}`,
        speech: "What is your phone number?",
      };
    case "shortlet_property_type":
      return {
        screen: `Shortlet property type? (format: studio)${suf}`,
        speech: "Which shortlet property type?",
      };
    case "shortlet_guests":
      return {
        screen: `How many guests? (format: 4)${suf}`,
        speech: "How many guests?",
      };
    case "travel_type":
      return {
        screen: `Travel type: solo, couple, family, group, or business? (format: family)${suf}`,
        speech: "What is your travel type?",
      };
    case "check_in":
      return {
        screen: `Check-in date? (format: YYYY-MM-DD)${suf}`,
        speech: "What is your check-in date?",
      };
    case "check_out":
      return {
        screen: `Check-out date? (format: YYYY-MM-DD)${suf}`,
        speech: "What is your check-out date?",
      };
    case "jv_measurement_unit":
      return {
        screen: `Land measurement unit for the JV site? plot, sqm, hectares, or acres? (format: acres)${suf}`,
        speech: "What unit for the joint venture land size?",
      };
    case "jv_min_land_size":
      return {
        screen: `Minimum land size you are looking for? (format: 2 acres or 1000 sqm)${suf}`,
        speech: "What minimum land size are you looking for?",
      };
    case "jv_development_types":
      return {
        screen: `What development type(s)? residential, commercial, mixed-use, or industrial — comma-separated if more than one. (format: residential)${suf}`,
        speech: "Which development types are you interested in for this joint venture?",
      };
    case "jv_sharing_ratio":
      return {
        screen: `Preferred profit or equity sharing ratio? (format: 60-40)${suf}`,
        speech: "What sharing ratio do you prefer?",
      };
    case "jv_title_requirements":
      return {
        screen: `Minimum title documents required? e.g. certificate of occupancy, survey plan — comma-separated. (format: C of O)${suf}`,
        speech: "Which title documents are required at minimum?",
      };
    case "jv_company_name":
      return {
        screen: `Company or developer name for this JV? (format: Acme Developers Ltd)${suf}`,
        speech: "What is your company or developer name?",
      };
    case "off_plan_completion_date":
      return {
        screen: `Expected completion date for the off-plan property? (format: 2027-06-30)${suf}`,
        speech: "When do you expect the property to be completed?",
      };
    case "off_plan_development_stage":
      return {
        screen: `Current development stage? planning, foundation, structural, finishing, or near-completion. (format: foundation)${suf}`,
        speech: "What development stage is the project at?",
      };
    case "off_plan_payment_plan":
      return {
        screen: `Preferred payment plan? outright or installment over 6, 12, 18, 24, or 36 months. (format: 12 months installment)${suf}`,
        speech: "Which payment plan do you prefer?",
      };
    case "features":
      return {
        screen: `Any must-have amenities? List a few separated by commas (e.g. pool, gated estate, BQ), or say none or skip.${suf}`,
        speech: "What amenities are must-haves?",
      };
    case "car_parks":
      return {
        screen: `How many car parking spaces do you need? (format: 2) Say skip if you do not care.${suf}`,
        speech: "How many car parking spaces?",
      };
    case "additional_notes":
      return {
        screen: `Anything else we should know? A short description is optional — say skip if nothing to add.${suf}`,
        speech: "Any other notes or description?",
      };
    default:
      return { screen: "", speech: "" };
  }
}

export function getConversationFieldDisplayLine(
  id: ConversationFieldId,
  preferenceType: string | undefined,
  remainingAfterThis: number
): string {
  return getConversationFieldDisplayLines(id, preferenceType ?? "", remainingAfterThis).screen.trim();
}

/** Full validation list for summary submit (same rules, unordered unique). */
export function getAllMissingConversationFields(
  data: Record<string, unknown> | null | undefined,
  skipped?: Iterable<ConversationFieldId>
): ConversationFieldId[] {
  const skipSet = skipped ? new Set(skipped) : new Set<ConversationFieldId>();
  if (!data) return (["preference_type"] as const).filter((id) => !skipSet.has(id as ConversationFieldId)) as ConversationFieldId[];
  const ptRaw = String(data.preferenceType ?? "").toLowerCase();
  if (!["buy", "rent", "joint-venture", "shortlet", "off-plan"].includes(ptRaw)) {
    return (["preference_type"] as const).filter((id) => !skipSet.has(id as ConversationFieldId)) as ConversationFieldId[];
  }
  const pt = ptRaw as NormalizedPreferenceType;
  const order = baseOrderForType(pt);
  return order.filter((id) => !skipSet.has(id) && isConversationFieldMissing(data, id));
}

export function isAiPreferenceDataCompleteForSubmit(
  data: Record<string, unknown> | null,
  skipped?: Iterable<ConversationFieldId>
): {
  ok: boolean;
  missing: ConversationFieldId[];
  contactReasons: string[];
} {
  const missing = getAllMissingConversationFields(data, skipped);
  const contactReasons: string[] = [];
  if (!data) {
    return { ok: false, missing, contactReasons: ["Add your contact details."] };
  }
  const c = data.contactInfo as Record<string, unknown> | undefined;
  if (!c?.fullName || String(c.fullName).trim().length < 2) contactReasons.push("full name");
  if (!c?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(c.email))) contactReasons.push("email");
  if (!phoneOk(data)) contactReasons.push("phone number");
  return {
    ok: missing.length === 0 && contactReasons.length === 0,
    missing,
    contactReasons,
  };
}
