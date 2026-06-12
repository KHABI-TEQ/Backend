/**
 * Builds the POST /preferences/submit payload (general preference — no receiverMode).
 * Must match backend Joi: common block + features + contactInfo + exactly one of
 * propertyDetails | developmentDetails | bookingDetails.
 *
 * Used by the AI summary submit flow; mirrors `generatePayload` in `app/preference/page.tsx`.
 */

import type { PreferencePayload } from "./schema";

type FormData = Record<string, unknown>;

function toStr(v: unknown): string {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function filterStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter((s) => s.length > 0);
}

/** API stores measurement lowercased; accepts plot, sqm, acres, hectares (+ legacy hectare / ha). */
export function normalizeMeasurementUnitForApi(v: unknown): string {
  const s = toStr(v).toLowerCase();
  if (!s) return "";
  if (s === "hectare" || s === "ha") return "hectares";
  return s;
}

function minBedroomsStr(pd: Record<string, unknown> | undefined): string {
  if (!pd) return "";
  const v = pd.bedrooms ?? pd.minBedrooms;
  if (typeof v === "string") return v.trim() || "0";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(Number(v) || 0);
}

/**
 * `lgasWithAreas` is required (may be []). Prefer `enhancedLocation.lgasWithAreas`;
 * else derive from `location.lgas` / `localGovernmentAreas` + `location.areas`.
 */
function buildLgasWithAreas(formData: FormData): { lgaName: string; areas: string[] }[] {
  const enhanced = (formData as { enhancedLocation?: { lgasWithAreas?: unknown } }).enhancedLocation
    ?.lgasWithAreas;
  if (Array.isArray(enhanced) && enhanced.length > 0) {
    return (enhanced as { lgaName?: string; areas?: unknown }[])
      .filter((item) => toStr(item?.lgaName))
      .map((item) => ({
        lgaName: toStr(item.lgaName),
        areas: filterStringArray(item.areas),
      }));
  }

  const loc = (formData.location || {}) as Record<string, unknown>;
  const lgas = (
    Array.isArray(loc.lgas)
      ? loc.lgas
      : Array.isArray(loc.localGovernmentAreas)
        ? loc.localGovernmentAreas
        : []
  )
    .map((x) => toStr(x))
    .filter(Boolean);

  const stateStr = toStr(loc.state);
  const lgaLower = new Set(lgas.map((l) => l.toLowerCase()));
  let areas = filterStringArray(loc.areas);
  areas = areas.filter(
    (a) =>
      a.toLowerCase() !== stateStr.toLowerCase() &&
      !lgaLower.has(a.toLowerCase()),
  );

  if (lgas.length === 1) {
    return [{ lgaName: lgas[0], areas }];
  }
  if (lgas.length > 1) {
    if (areas.length > 0) {
      return lgas.map((lga, i) => ({ lgaName: lga, areas: i === 0 ? areas : [] }));
    }
    return lgas.map((lga) => ({ lgaName: lga, areas: [] }));
  }
  return [];
}

/** Ensures minBedrooms are strings where the API expects string ids. */
function ensurePreferencePayloadStrings(payload: Record<string, unknown>): void {
  const pd = payload.propertyDetails as Record<string, unknown> | undefined;
  if (pd && pd.minBedrooms !== undefined) {
    pd.minBedrooms =
      typeof pd.minBedrooms === "string" ? pd.minBedrooms : String(pd.minBedrooms ?? "0");
  }
  const bd = payload.bookingDetails as Record<string, unknown> | undefined;
  if (bd && bd.minBedrooms !== undefined) {
    bd.minBedrooms =
      typeof bd.minBedrooms === "string" ? bd.minBedrooms : String(bd.minBedrooms ?? "0");
  }
}

function compactPayload<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  Object.keys(out).forEach((k) => {
    const v = out[k];
    if (v === null || v === undefined) delete out[k];
  });
  return out as T;
}

export function buildPreferencePayload(
  formData: FormData,
  selectedPreferenceType: string,
): PreferencePayload {
  const fd = { ...formData };
  delete (fd as { receiverMode?: unknown }).receiverMode;

  const loc = (fd.location || {}) as Record<string, unknown>;
  const lgas = (
    Array.isArray(loc.lgas)
      ? loc.lgas
      : Array.isArray(loc.localGovernmentAreas)
        ? loc.localGovernmentAreas
        : []
  )
    .map((x) => toStr(x))
    .filter(Boolean);

  const lgasWithAreas = buildLgasWithAreas(fd);
  const effectiveLgasWithAreas =
    lgasWithAreas.length > 0
      ? lgasWithAreas
      : lgas.map((name) => ({ lgaName: name, areas: [] as string[] }));

  const feat = (fd.features || {}) as Record<string, unknown>;
  const basePayload = {
    preferenceType: selectedPreferenceType,
    preferenceMode:
      selectedPreferenceType === "buy" || selectedPreferenceType === "off-plan"
        ? "buy"
        : selectedPreferenceType === "rent"
          ? "tenant"
          : selectedPreferenceType === "joint-venture"
            ? "developer"
            : "shortlet",
    location: {
      state: toStr(loc.state),
      localGovernmentAreas: lgas,
      lgasWithAreas: effectiveLgasWithAreas,
      customLocation: toStr(loc.customLocation),
    },
    budget: {
      minPrice: Number((fd.budget as { minPrice?: number })?.minPrice) || 0,
      maxPrice: Number((fd.budget as { maxPrice?: number })?.maxPrice) || 0,
      currency: "NGN" as const,
    },
    features: {
      baseFeatures: filterStringArray(
        (feat.basicFeatures as unknown[]) ?? (feat.baseFeatures as unknown[]),
      ),
      premiumFeatures: filterStringArray(feat.premiumFeatures as unknown[]),
      autoAdjustToFeatures: Boolean(
        feat.autoAdjustToFeatures ?? feat.autoAdjustToBudget,
      ),
    },
  };

  const contact = (fd.contactInfo || {}) as Record<string, unknown>;

  switch (selectedPreferenceType) {
    case "buy": {
      const buyData = fd;
      const pd = (buyData.propertyDetails || {}) as Record<string, unknown>;
      const buyPayload = {
        ...basePayload,
        preferenceType: "buy" as const,
        preferenceMode: "buy" as const,
        propertyDetails: {
          propertyType: toStr(pd.propertySubtype ?? pd.propertyType),
          buildingType: toStr(pd.buildingType),
          minBedrooms: minBedroomsStr(pd),
          minBathrooms: Number(pd.bathrooms ?? pd.minBathrooms) || 0,
          leaseTerm: toStr(pd.leaseTerm) || "",
          propertyCondition: toStr(pd.propertyCondition),
          purpose: toStr(pd.purpose) || "For living",
          landSize: toStr(pd.landSize),
          minLandSize: toStr(pd.minLandSize),
          maxLandSize: toStr(pd.maxLandSize),
          measurementUnit: normalizeMeasurementUnitForApi(pd.measurementUnit),
          documentTypes: filterStringArray(pd.documentTypes),
          landConditions: filterStringArray(pd.landConditions),
        },
        contactInfo: {
          fullName: toStr(contact.fullName),
          email: toStr(contact.email),
          phoneNumber: toStr(contact.phoneNumber),
        },
        nearbyLandmark: toStr(
          (pd as Record<string, unknown>).nearbyLandmark ?? buyData.nearbyLandmark,
        ),
        additionalNotes: (() => {
          const parts: string[] = [];
          const baseNotes = toStr(buyData.additionalNotes);
          if (baseNotes) parts.push(baseNotes);
          if (pd.toilets != null && toStr(pd.toilets)) {
            parts.push(`Preferred toilets: ${pd.toilets}`);
          }
          const pk =
            (pd as Record<string, unknown>).parkingSpaces ??
            (pd as Record<string, unknown>).carParks;
          if (pk != null && toStr(pk)) {
            parts.push(`Preferred car parks: ${pk}`);
          }
          return parts.join(" ").trim();
        })(),
      };
      ensurePreferencePayloadStrings(buyPayload as unknown as Record<string, unknown>);
      return compactPayload(buyPayload) as PreferencePayload;
    }

    case "rent": {
      const rentData = fd;
      const pd = (rentData.propertyDetails || {}) as Record<string, unknown>;
      const rentPayload = {
        ...basePayload,
        preferenceType: "rent" as const,
        preferenceMode: "tenant" as const,
        propertyDetails: {
          propertyType: toStr(pd.propertySubtype ?? pd.propertyType),
          buildingType: toStr(pd.buildingType),
          minBedrooms: minBedroomsStr(pd),
          minBathrooms: Number(pd.bathrooms ?? pd.minBathrooms) || 0,
          leaseTerm: toStr(pd.leaseTerm) || "1 Year",
          propertyCondition: toStr(pd.propertyCondition),
          purpose: toStr(pd.purpose) || "Residential",
          landSize: toStr(pd.landSize),
          minLandSize: toStr(pd.minLandSize),
          maxLandSize: toStr(pd.maxLandSize),
          measurementUnit: normalizeMeasurementUnitForApi(pd.measurementUnit),
          documentTypes: filterStringArray(pd.documentTypes),
          landConditions: filterStringArray(pd.landConditions),
        },
        contactInfo: {
          fullName: toStr(contact.fullName),
          email: toStr(contact.email),
          phoneNumber: toStr(contact.phoneNumber),
        },
        nearbyLandmark: toStr(
          (pd as Record<string, unknown>).nearbyLandmark ?? rentData.nearbyLandmark,
        ),
        additionalNotes: toStr(rentData.additionalNotes),
      };
      ensurePreferencePayloadStrings(rentPayload as unknown as Record<string, unknown>);
      return compactPayload(rentPayload) as PreferencePayload;
    }

    case "joint-venture": {
      const jvData = fd;
      const dev = (jvData.developmentDetails || {}) as Record<string, unknown>;
      const jvPayload = {
        ...basePayload,
        preferenceType: "joint-venture" as const,
        preferenceMode: "developer" as const,
        developmentDetails: {
          minLandSize: toStr(dev.minLandSize),
          maxLandSize: toStr(dev.maxLandSize),
          measurementUnit: normalizeMeasurementUnitForApi(dev.measurementUnit),
          developmentTypes: filterStringArray(dev.developmentTypes),
          preferredSharingRatio: toStr(dev.preferredSharingRatio),
          proposalDetails: toStr(dev.proposalDetails),
          minimumTitleRequirements: filterStringArray(dev.minimumTitleRequirements),
          willingToConsiderPendingTitle: Boolean(dev.willingToConsiderPendingTitle),
          additionalRequirements: toStr(dev.additionalRequirements),
        },
        contactInfo: {
          companyName: toStr(contact.companyName),
          contactPerson: toStr(contact.contactPerson ?? contact.fullName),
          email: toStr(contact.email),
          phoneNumber: toStr(contact.phoneNumber),
          ...(toStr(contact.cacRegistrationNumber)
            ? { cacRegistrationNumber: toStr(contact.cacRegistrationNumber) }
            : {}),
        },
        partnerExpectations: toStr(jvData.partnerExpectations) || undefined,
        nearbyLandmark: toStr(jvData.nearbyLandmark),
        additionalNotes: toStr(jvData.additionalNotes),
      };
      return compactPayload(jvPayload) as PreferencePayload;
    }

    case "off-plan": {
      const offPlanData = fd;
      const pd = (offPlanData.propertyDetails || {}) as Record<string, unknown>;
      const offPlanPayload = {
        ...basePayload,
        preferenceType: "off-plan" as const,
        preferenceMode: "buy" as const,
        propertyDetails: {
          propertyType: toStr(pd.propertySubtype ?? pd.propertyType),
          buildingType: toStr(pd.buildingType),
          minBedrooms: minBedroomsStr(pd),
          minBathrooms: Number(pd.bathrooms ?? pd.minBathrooms) || 0,
          propertyCondition: toStr(pd.propertyCondition),
          purpose: toStr(pd.purpose) || "Investment",
          landSize: toStr(pd.landSize),
          minLandSize: toStr(pd.minLandSize),
          maxLandSize: toStr(pd.maxLandSize),
          measurementUnit: normalizeMeasurementUnitForApi(pd.measurementUnit),
          documentTypes: filterStringArray(pd.documentTypes),
          landConditions: filterStringArray(pd.landConditions),
          expectedCompletionDate: toStr(pd.expectedCompletionDate),
          developmentStage: toStr(pd.developmentStage),
          paymentPlan: toStr(pd.paymentPlan),
        },
        contactInfo: {
          fullName: toStr(contact.fullName),
          email: toStr(contact.email),
          phoneNumber: toStr(contact.phoneNumber),
        },
        nearbyLandmark: toStr(
          (pd as Record<string, unknown>).nearbyLandmark ?? offPlanData.nearbyLandmark,
        ),
        additionalNotes: toStr(offPlanData.additionalNotes),
      };
      ensurePreferencePayloadStrings(offPlanPayload as unknown as Record<string, unknown>);
      return compactPayload(offPlanPayload) as PreferencePayload;
    }

    case "shortlet": {
      const shortletData = fd;
      const pd = (shortletData.propertyDetails || {}) as Record<string, unknown>;
      const bd = (shortletData.bookingDetails || {}) as Record<string, unknown>;
      const bookingDetails = {
        propertyType: toStr(pd.propertyType),
        buildingType: toStr(pd.buildingType ?? bd.buildingType),
        minBedrooms: minBedroomsStr(pd),
        minBathrooms: Number(pd.bathrooms ?? bd.minBathrooms) || 0,
        numberOfGuests: Number(pd.maxGuests ?? bd.numberOfGuests) || 0,
        checkInDate: toStr(bd.checkInDate),
        checkOutDate: toStr(bd.checkOutDate),
        travelType: toStr(pd.travelType ?? bd.travelType),
        preferredCheckInTime: toStr(
          bd.preferredCheckInTime ?? contact.preferredCheckInTime,
        ),
        preferredCheckOutTime: toStr(
          bd.preferredCheckOutTime ?? contact.preferredCheckOutTime,
        ),
        propertyCondition: toStr(pd.propertyCondition ?? bd.propertyCondition),
        purpose: toStr(pd.purpose ?? bd.purpose),
        landSize: toStr(pd.landSize ?? bd.landSize),
        minLandSize: toStr(pd.minLandSize ?? bd.minLandSize),
        maxLandSize: toStr(pd.maxLandSize ?? bd.maxLandSize),
        measurementUnit: normalizeMeasurementUnitForApi(
          pd.measurementUnit ?? bd.measurementUnit,
        ),
        documentTypes: filterStringArray(pd.documentTypes ?? bd.documentTypes),
        landConditions: filterStringArray(pd.landConditions ?? bd.landConditions),
      };
      const shortletPayload = {
        ...basePayload,
        preferenceType: "shortlet" as const,
        preferenceMode: "shortlet" as const,
        bookingDetails,
        contactInfo: {
          fullName: toStr(contact.fullName),
          email: toStr(contact.email),
          phoneNumber: toStr(contact.phoneNumber),
          petsAllowed: Boolean(contact.petsAllowed),
          smokingAllowed: Boolean(contact.smokingAllowed),
          partiesAllowed: Boolean(contact.partiesAllowed),
          additionalRequests: toStr(contact.additionalRequests),
          maxBudgetPerNight: Number(contact.maxBudgetPerNight) || 0,
          willingToPayExtra: Boolean(contact.willingToPayExtra),
          cleaningFeeBudget: Number(contact.cleaningFeeBudget) || 0,
          securityDepositBudget: Number(contact.securityDepositBudget) || 0,
          cancellationPolicy: toStr(contact.cancellationPolicy),
          preferredCheckInTime: toStr(contact.preferredCheckInTime),
          preferredCheckOutTime: toStr(contact.preferredCheckOutTime),
        },
        nearbyLandmark: toStr(
          (pd as Record<string, unknown>).nearbyLandmark ?? shortletData.nearbyLandmark,
        ),
        additionalNotes: toStr(shortletData.additionalNotes),
      };
      ensurePreferencePayloadStrings(shortletPayload as unknown as Record<string, unknown>);
      return compactPayload(shortletPayload) as PreferencePayload;
    }

    default:
      return basePayload as unknown as PreferencePayload;
  }
}
