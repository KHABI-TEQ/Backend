/** Shared KYC lifecycle for Agent, Developer, and Landowner accounts. */
export type PublisherKycStatus = "none" | "pending" | "in_review" | "approved" | "rejected";

export const PUBLISHER_KYC_USER_TYPES = ["Agent", "Developer", "Landowners"] as const;
export type PublisherKycUserType = (typeof PUBLISHER_KYC_USER_TYPES)[number];

export function isPublisherKycUserType(userType: string | undefined | null): userType is PublisherKycUserType {
  return PUBLISHER_KYC_USER_TYPES.includes(String(userType || "") as PublisherKycUserType);
}
