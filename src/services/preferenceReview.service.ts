import mongoose from "mongoose";
import { DB } from "../controllers";
import { RouteError } from "../common/classes";
import HttpStatusCodes from "../common/HttpStatusCodes";
import { getPreferencePhysicalPropertyType } from "../utils/preferencePhysicalTypeMatch";
import { computeMatchingPropertyIdsForPreference } from "./autoPreferencePairing.service";
import {
  BUDGET_FIT_VALUES,
  REVIEW_BUDGET_FIT_VALUES,
  type AvailabilityFit,
  type BudgetFit,
  type SpecFit,
} from "../models/preferenceReview";

const MIN_OUTLOOK_SAMPLE = 3;

export type ReviewUpsertBody = {
  budgetFit?: string;
  availability?: string;
  specFit?: string;
  suggestedBudget?: { min?: number; max?: number; currency?: string };
  suggestedSpec?: { minBedrooms?: string };
  availabilityNote?: string;
  specNote?: string;
};

export type MatchingOutlookDraft = {
  preferenceType?: string;
  propertyType?: string;
  location?: any;
  budget?: { minPrice?: number; maxPrice?: number; currency?: string };
  propertyDetails?: { propertyType?: string; minBedrooms?: string };
  bookingDetails?: { propertyType?: string; minBedrooms?: string };
};

function isBudgetFit(v: unknown): v is BudgetFit {
  return BUDGET_FIT_VALUES.includes(v as BudgetFit);
}
function isReviewBudgetFit(v: unknown): v is "too_low" | "moderate" {
  return REVIEW_BUDGET_FIT_VALUES.includes(v as "too_low" | "moderate");
}

export function extractLocationKeys(location: any): {
  state: string;
  lgas: string[];
  areas: string[];
  estates: string[];
} {
  const state = String(location?.state || "").trim();
  const lgas = new Set<string>();
  const areas = new Set<string>();
  const estates = new Set<string>();

  for (const lga of location?.localGovernmentAreas || []) {
    const s = String(lga || "").trim();
    if (s) lgas.add(s);
  }
  for (const row of location?.lgasWithAreas || []) {
    const lgaName = String(row?.lgaName || "").trim();
    if (lgaName) lgas.add(lgaName);
    for (const a of row?.areas || []) {
      const s = String(a || "").trim();
      if (s) areas.add(s);
    }
    for (const ae of row?.areasWithEstates || []) {
      const areaName = String(ae?.areaName || "").trim();
      if (areaName) areas.add(areaName);
      for (const e of ae?.estates || []) {
        const s = String(e || "").trim();
        if (s) estates.add(s);
      }
    }
  }

  return {
    state,
    lgas: [...lgas],
    areas: [...areas],
    estates: [...estates],
  };
}

function budgetMid(min?: number | null, max?: number | null): number | undefined {
  const a = Number(min);
  const b = Number(max);
  const hasA = Number.isFinite(a);
  const hasB = Number.isFinite(b);
  if (hasA && hasB) return (a + b) / 2;
  if (hasA) return a;
  if (hasB) return b;
  return undefined;
}

function parseSuggestedBudget(raw: ReviewUpsertBody["suggestedBudget"]) {
  const min = Number(raw?.min);
  const max = Number(raw?.max);
  if (!Number.isFinite(min) || min <= 0) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Enter a suggested minimum budget greater than 0."
    );
  }
  if (!Number.isFinite(max) || max < min) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Suggested maximum budget must be at least the suggested minimum."
    );
  }
  return {
    min,
    max,
    currency: String(raw?.currency || "NGN").toUpperCase() || "NGN",
  };
}

function assertReviewBody(body: ReviewUpsertBody) {
  const budgetFit = body.budgetFit || "moderate";
  if (!isReviewBudgetFit(budgetFit)) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Choose whether the budget is too low or moderate."
    );
  }

  if (budgetFit === "moderate" && body.suggestedBudget) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Suggested budget is only used when you mark the budget too low."
    );
  }

  let suggestedBudget: { min: number; max: number; currency: string } | undefined;
  if (budgetFit === "too_low") {
    suggestedBudget = parseSuggestedBudget(body.suggestedBudget);
  }

  const suggestedSpec: { minBedrooms?: string } | undefined = undefined;
  return {
    budgetFit,
    availability: "typical" as AvailabilityFit,
    specFit: "typical" as SpecFit,
    suggestedBudget,
    suggestedSpec,
    availabilityNote: "",
    specNote: "",
  };
}

function emptySummary() {
  return {
    reviewCount: 0,
    budgetFit: { too_low: 0, moderate: 0, too_high: 0 },
    availability: { scarce: 0, typical: 0, plentiful: 0 },
    specFit: { underspec: 0, typical: 0, overspec: 0 },
  };
}

function summarize(rows: Array<{ budgetFit: string; availability: string; specFit: string }>) {
  const summary = emptySummary();
  summary.reviewCount = rows.length;
  for (const row of rows) {
    if (row.budgetFit in summary.budgetFit) {
      summary.budgetFit[row.budgetFit as BudgetFit] += 1;
    }
    if (row.availability in summary.availability) {
      summary.availability[row.availability as AvailabilityFit] += 1;
    }
    if (row.specFit in summary.specFit) {
      summary.specFit[row.specFit as SpecFit] += 1;
    }
  }
  return summary;
}

function formatOwnReview(doc: any) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    preferenceId: String(doc.preferenceId),
    budgetFit: doc.budgetFit === "too_low" ? "too_low" : "moderate",
    availability: doc.availability,
    specFit: doc.specFit,
    suggestedBudget: doc.suggestedBudget?.min
      ? {
          min: doc.suggestedBudget.min,
          max: doc.suggestedBudget.max,
          currency: doc.suggestedBudget.currency || "NGN",
        }
      : null,
    suggestedSpec: doc.suggestedSpec?.minBedrooms
      ? { minBedrooms: doc.suggestedSpec.minBedrooms }
      : null,
    availabilityNote: doc.availabilityNote || "",
    specNote: doc.specNote || "",
    updatedAt: doc.updatedAt,
  };
}

export function assertMarketplacePreference(preference: any) {
  if (!preference) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Preference not found.");
  }
  if (String(preference.receiverMode?.type || "").toLowerCase() === "dealsite") {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "DealSite preferences are not reviewed on the general marketplace."
    );
  }
  const status = String(preference.status || "");
  if (!["approved", "matched"].includes(status)) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Only approved marketplace preferences can be reviewed."
    );
  }
}

export async function upsertReview(
  agentId: string,
  preferenceId: string,
  body: ReviewUpsertBody
) {
  if (!mongoose.Types.ObjectId.isValid(preferenceId)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid preference id.");
  }

  const parsed = assertReviewBody(body);
  const preference = await DB.Models.Preference.findById(preferenceId).lean();
  assertMarketplacePreference(preference);

  const loc = extractLocationKeys(preference.location);
  if (!loc.state) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "This preference has no state, so it cannot be reviewed."
    );
  }

  const min = Number(preference.budget?.minPrice);
  const max = Number(preference.budget?.maxPrice);
  const mid = budgetMid(min, max);
  const propertyType = getPreferencePhysicalPropertyType(preference) || "";

  const payload: Record<string, unknown> = {
    preferenceId,
    agentId,
    budgetFit: parsed.budgetFit,
    availability: "typical",
    specFit: "typical",
    availabilityNote: "",
    specNote: "",
    preferenceType: preference.preferenceType,
    propertyType,
    state: loc.state,
    lgas: loc.lgas,
    areas: loc.areas,
    estates: loc.estates,
    budgetMin: Number.isFinite(min) ? min : undefined,
    budgetMax: Number.isFinite(max) ? max : undefined,
    budgetMid: mid,
  };

  const update: Record<string, unknown> = { $set: payload };
  if (parsed.suggestedBudget) {
    payload.suggestedBudget = parsed.suggestedBudget;
  } else {
    update.$unset = { suggestedBudget: 1, suggestedSpec: 1 };
  }

  const doc = await DB.Models.PreferenceReview.findOneAndUpdate(
    { agentId, preferenceId },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const summary = await getPreferenceReviewSummary(preferenceId);
  return { review: formatOwnReview(doc), summary };
}

export async function getMyReview(agentId: string, preferenceId: string) {
  if (!mongoose.Types.ObjectId.isValid(preferenceId)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid preference id.");
  }
  const preference = await DB.Models.Preference.findById(preferenceId).lean();
  assertMarketplacePreference(preference);

  const [mine, summary] = await Promise.all([
    DB.Models.PreferenceReview.findOne({ agentId, preferenceId }).lean(),
    getPreferenceReviewSummary(preferenceId),
  ]);
  return { review: formatOwnReview(mine), summary };
}

export async function getPreferenceReviewSummary(preferenceId: string) {
  const rows = await DB.Models.PreferenceReview.find({ preferenceId })
    .select("budgetFit availability specFit")
    .lean();
  return summarize(rows as any);
}

export async function attachReviewsToPreferences(
  preferences: any[],
  agentId?: string
) {
  const ids = preferences
    .map((p) => p._id || p.id || p.preferenceId)
    .filter(Boolean)
    .map((id: any) => String(id));
  if (!ids.length) return preferences;

  const objectIds = ids
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const all = await DB.Models.PreferenceReview.find({
    preferenceId: { $in: objectIds },
  })
    .select("preferenceId agentId budgetFit suggestedBudget")
    .lean();

  const byPref = new Map<string, any[]>();
  for (const row of all) {
    const key = String(row.preferenceId);
    const list = byPref.get(key) || [];
    list.push(row);
    byPref.set(key, list);
  }

  return preferences.map((p) => {
    const key = String(p._id || p.id || p.preferenceId || "");
    const rows = byPref.get(key) || [];
    const mine = agentId
      ? rows.find((r) => String(r.agentId) === String(agentId))
      : null;
    return {
      ...p,
      reviewSummary: summarize(rows),
      myReview: mine
        ? {
            budgetFit: mine.budgetFit === "too_low" ? "too_low" : "moderate",
            suggestedBudget: mine.suggestedBudget?.min
              ? {
                  min: mine.suggestedBudget.min,
                  max: mine.suggestedBudget.max,
                  currency: mine.suggestedBudget.currency || "NGN",
                }
              : null,
          }
        : null,
    };
  });
}

function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function medianStringNumber(values: string[]): string | null {
  const nums = values
    .map((v) => Number(String(v).replace(/[^0-9.]/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = nums[Math.floor((nums.length - 1) / 2)];
  return String(Math.round(mid));
}

function uniqueAgentCount(rows: Array<{ agentId: unknown }>) {
  return new Set(rows.map((r) => String(r.agentId))).size;
}

async function reviewsAtGrain(draft: MatchingOutlookDraft, grain: "estate" | "area" | "lga") {
  const loc = extractLocationKeys(draft.location);
  const preferenceType = String(draft.preferenceType || "").trim();
  const propertyType =
    String(
      draft.propertyType ||
        draft.propertyDetails?.propertyType ||
        draft.bookingDetails?.propertyType ||
        ""
    ).trim();

  const filter: Record<string, unknown> = {};
  if (preferenceType) filter.preferenceType = preferenceType;
  if (loc.state) filter.state = loc.state;
  if (loc.lgas.length) filter.lgas = { $in: loc.lgas };
  if (propertyType) {
    filter.$or = [{ propertyType }, { propertyType: "" }, { propertyType: null }];
  }

  if (grain === "estate") {
    if (!loc.estates.length) return [];
    filter.estates = { $in: loc.estates };
  } else if (grain === "area") {
    if (!loc.areas.length) return [];
    filter.areas = { $in: loc.areas };
  } else if (!loc.lgas.length) {
    return [];
  }

  return DB.Models.PreferenceReview.find(filter).lean();
}

async function pickReviewSample(draft: MatchingOutlookDraft) {
  const loc = extractLocationKeys(draft.location);
  const grains: Array<"estate" | "area" | "lga"> = [];
  if (loc.estates.length) grains.push("estate");
  if (loc.areas.length) grains.push("area");
  grains.push("lga");

  for (const grain of grains) {
    const rows = await reviewsAtGrain(draft, grain);
    if (uniqueAgentCount(rows) >= MIN_OUTLOOK_SAMPLE) {
      return { rows, grain };
    }
  }

  // Best available even if under the sample floor
  for (const grain of grains) {
    const rows = await reviewsAtGrain(draft, grain);
    if (rows.length) return { rows, grain };
  }
  return { rows: [] as any[], grain: "lga" as const };
}

function naira(n: number) {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

export async function matchingOutlook(draft: MatchingOutlookDraft) {
  const preferenceType = String(draft.preferenceType || "").trim();
  const loc = extractLocationKeys(draft.location);
  if (!preferenceType || !loc.state || !loc.lgas.length) {
    return {
      outlook: "unknown" as const,
      confidence: "low" as const,
      listingCountInBudget: 0,
      listingCountNearby: 0,
      reviewSampleSize: 0,
      budgetSignal: null,
      typicalBudget: null,
      typicalBedrooms: null,
      message:
        "Add a property type, location, and budget to see matching possibility.",
    };
  }

  const { rows, grain } = await pickReviewSample(draft);
  const reviewSampleSize = uniqueAgentCount(rows);

  const mids: number[] = [];
  const bedroomHints: string[] = [];
  const budgetVotes = { too_low: 0, moderate: 0, too_high: 0 };

  for (const row of rows) {
    if (row.budgetFit === "moderate" && Number.isFinite(Number(row.budgetMid))) {
      mids.push(Number(row.budgetMid));
    }
    if (
      (row.budgetFit === "too_low" || row.budgetFit === "too_high") &&
      Number.isFinite(Number(row.suggestedBudget?.min)) &&
      Number.isFinite(Number(row.suggestedBudget?.max))
    ) {
      mids.push(
        (Number(row.suggestedBudget.min) + Number(row.suggestedBudget.max)) / 2
      );
    }
    if (row.suggestedSpec?.minBedrooms) {
      bedroomHints.push(String(row.suggestedSpec.minBedrooms));
    }
    if (row.budgetFit in budgetVotes) {
      budgetVotes[row.budgetFit as BudgetFit] += 1;
    }
  }

  mids.sort((a, b) => a - b);
  const p25 = percentile(mids, 0.25);
  const p75 = percentile(mids, 0.75);
  const typicalBudget =
    p25 != null && p75 != null
      ? { min: Math.round(p25), max: Math.round(p75), currency: "NGN" }
      : null;
  const typicalBedrooms = medianStringNumber(bedroomHints);

  const synthetic: any = {
    preferenceType,
    location: {
      state: loc.state,
      localGovernmentAreas: loc.lgas.length
        ? loc.lgas
        : draft.location?.localGovernmentAreas,
      lgasWithAreas: draft.location?.lgasWithAreas,
    },
    budget: {
      minPrice: draft.budget?.minPrice,
      maxPrice: draft.budget?.maxPrice,
    },
    propertyDetails: {
      propertyType:
        draft.propertyType ||
        draft.propertyDetails?.propertyType ||
        draft.bookingDetails?.propertyType,
      minBedrooms:
        draft.propertyDetails?.minBedrooms ||
        draft.bookingDetails?.minBedrooms,
    },
    bookingDetails: draft.bookingDetails,
  };

  const nearbyPref = {
    ...synthetic,
    budget: { minPrice: undefined, maxPrice: undefined },
  };

  const [inBudgetIds, nearbyIds] = await Promise.all([
    computeMatchingPropertyIdsForPreference(synthetic).catch(() => []),
    computeMatchingPropertyIdsForPreference(nearbyPref).catch(() => []),
  ]);
  const listingCountInBudget = inBudgetIds.length;
  const listingCountNearby = nearbyIds.length;

  const draftMax = Number(draft.budget?.maxPrice);
  const draftMin = Number(draft.budget?.minPrice);
  let budgetSignal: BudgetFit | null = null;
  if (typicalBudget && Number.isFinite(draftMax) && Number.isFinite(draftMin)) {
    if (draftMax < typicalBudget.min * 0.9) budgetSignal = "too_low";
    else if (draftMin > typicalBudget.max * 1.1) budgetSignal = "too_high";
    else budgetSignal = "moderate";
  } else if (reviewSampleSize) {
    const top = (Object.entries(budgetVotes) as [BudgetFit, number][]).sort(
      (a, b) => b[1] - a[1]
    )[0];
    budgetSignal = top && top[1] > 0 ? top[0] : null;
  }

  const hasSignal = reviewSampleSize > 0 || listingCountNearby > 0;
  let outlook: "low" | "moderate" | "high" | "unknown" = "unknown";
  if (!hasSignal) {
    outlook = "unknown";
  } else if (listingCountInBudget >= 3 && budgetSignal !== "too_low") {
    outlook = "high";
  } else if (listingCountInBudget >= 1 && budgetSignal !== "too_low") {
    outlook = "moderate";
  } else if (listingCountInBudget === 0 && (budgetSignal === "too_low" || listingCountNearby === 0)) {
    outlook = "low";
  } else {
    outlook = "moderate";
  }

  let confidence: "low" | "medium" | "high" = "low";
  if (reviewSampleSize >= 5 && listingCountNearby > 0) confidence = "high";
  else if (reviewSampleSize >= MIN_OUTLOOK_SAMPLE || listingCountNearby > 0) {
    confidence = "medium";
  }

  const place =
    loc.estates[0] || loc.areas[0] || loc.lgas[0] || loc.state || "this location";
  const grainLabel =
    grain === "estate" ? place : grain === "area" ? place : loc.lgas[0] || loc.state;

  let message = "We do not have enough local data yet to estimate matching chance.";
  if (outlook !== "unknown") {
    const chance =
      outlook === "high"
        ? "Matching chance looks high"
        : outlook === "low"
          ? "Matching chance looks low"
          : "Matching chance looks moderate";
    const budgetBit = typicalBudget
      ? ` Agents usually see this type in ${grainLabel} around ${naira(typicalBudget.min)}–${naira(typicalBudget.max)}.`
      : "";
    const bedBit = typicalBedrooms
      ? ` Typical bedroom count from agent reviews: ${typicalBedrooms}.`
      : "";
    const listBit =
      listingCountInBudget > 0
        ? ` About ${listingCountInBudget} live listing${listingCountInBudget === 1 ? "" : "s"} currently sit in your budget.`
        : listingCountNearby > 0
          ? ` There are listings nearby, but none currently sit inside your budget.`
          : ` Few or no live listings match this brief right now.`;
    const signalBit =
      budgetSignal === "too_low"
        ? " Your max is below the typical range."
        : budgetSignal === "too_high"
          ? " Your budget is above the typical range, which usually improves match chance."
          : "";
    message = `${chance}.${budgetBit}${bedBit}${listBit}${signalBit}`;
  }

  return {
    outlook,
    confidence,
    listingCountInBudget,
    listingCountNearby,
    reviewSampleSize,
    budgetSignal,
    typicalBudget,
    typicalBedrooms,
    message,
  };
}
