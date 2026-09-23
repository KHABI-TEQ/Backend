/** Shared KYC lifecycle for Agent, Developer, Landowner, and Property Scout accounts. */
export type PublisherKycStatus = "none" | "pending" | "in_review" | "approved" | "rejected";

/** Developer verification dimensions (company / representative / address). */
export type DeveloperDimensionStatus =
  | "none"
  | "pending"
  | "verified"
  | "requires_attention";

export const DEVELOPER_DIMENSION_STATUSES = [
  "none",
  "pending",
  "verified",
  "requires_attention",
] as const;

export type DeveloperCompanyType =
  | "business_name"
  | "limited_liability"
  | "other";

export const PUBLISHER_KYC_USER_TYPES = ["Agent", "Developer", "Landowners", "PropertyScout"] as const;
export type PublisherKycUserType = (typeof PUBLISHER_KYC_USER_TYPES)[number];

export function isPublisherKycUserType(userType: string | undefined | null): userType is PublisherKycUserType {
  return PUBLISHER_KYC_USER_TYPES.includes(String(userType || "") as PublisherKycUserType);
}
