import type { UserPreferences } from "../services/whatsAppNotification.service";

/**
 * Map a public preference payload or lean Preference doc to {@link UserPreferences} for WhatsApp copy.
 */
export function preferencePayloadToUserPreferences(p: {
  location?: { state?: string; localGovernmentAreas?: string[] };
  budget?: { minPrice?: number; maxPrice?: number };
  propertyDetails?: { propertyType?: string; minBedrooms?: string | number };
}): UserPreferences {
  if (!p) {
    return {};
  }
  const minBed = p.propertyDetails?.minBedrooms;
  return {
    propertyType: p.propertyDetails?.propertyType,
    minBedrooms:
      minBed !== undefined && minBed !== null && minBed !== ""
        ? parseInt(String(minBed), 10) || undefined
        : undefined,
    location: [p.location?.state, ...(p.location?.localGovernmentAreas || []).slice(0, 1)]
      .filter(Boolean)
      .join(", "),
    maxPrice: p.budget?.maxPrice,
  };
}
