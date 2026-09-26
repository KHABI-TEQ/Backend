import { getClientBaseUrl } from "./clientAppUrl";

export function isPreferenceInsuredSearch(preference: any): boolean {
  const status = String(preference?.searchInsurance?.status || "").toLowerCase();
  return status === "active" || status === "claimed";
}

export function isDealSitePreference(preference: any): boolean {
  return (
    String(preference?.receiverMode?.type || "") === "dealSite" &&
    Boolean(preference?.receiverMode?.dealSiteID)
  );
}

/** Main-site website preference (not a deal-site tenant, not the mobile app). */
export function isMainSiteWebsitePreference(preference: any): boolean {
  if (isDealSitePreference(preference)) return false;
  return String(preference?.submittedVia || "website").toLowerCase() !== "app";
}

export function publicPropertyMarketType(property: any): string {
  const brief = String(property?.briefType || property?.propertyType || "").toLowerCase();
  if (brief.includes("joint") || brief === "jv") return "jv";
  if (brief.includes("rent")) return "rent";
  if (brief.includes("short")) return "shortlet";
  return "buy";
}

export function publicFrontendPropertyPath(property: any): string {
  const id = String(property?._id || property?.id || "");
  return `/property/${publicPropertyMarketType(property)}/${id}`;
}

export function insuredMatchPath(
  propertyId: string,
  preferenceId?: string,
  matchedId?: string
): string {
  const q = new URLSearchParams();
  if (preferenceId) q.set("preferenceId", String(preferenceId));
  if (matchedId) q.set("matchedId", String(matchedId));
  const qs = q.toString();
  return `/buyer/matches/${propertyId}${qs ? `?${qs}` : ""}`;
}

export function clientAbsoluteUrl(path: string): string {
  const base = getClientBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

export function buyerLoginNextUrl(path: string): string {
  return clientAbsoluteUrl(`/buyer/login?next=${encodeURIComponent(path)}`);
}

export function preferenceIdFromBooking(booking: any): string {
  const meta = booking?.meta || {};
  return String(
    meta?.requestSource?.preferenceId ||
      meta?.preferenceId ||
      booking?.preferenceId ||
      ""
  );
}
