export const SEARCH_INSURANCE_CATALOG = {
  premiumAmount: 20_000,
  coverAmount: 2_000_000,
  currency: "NGN",
  partner: "Consolidated Hallmark Insurance Plc",
  productName: "Property Search Insurance",
  headline: "Search with Confidence. You're Protected.",
  tagline:
    "Insure your property search on Khabiteq with Consolidated Hallmark Insurance Plc and get up to ₦2,000,000 cover if something goes wrong.",
  perSearchLabel: "per search",
  benefits: [
    {
      title: "Financial Protection",
      text: "Cover for unexpected loss up to ₦2,000,000.",
    },
    {
      title: "Greater Peace of Mind",
      text: "Search and explore without fear.",
    },
    {
      title: "Trusted Partnership",
      text: "Backed by Consolidated Hallmark Insurance Plc.",
    },
  ],
} as const;

export type SearchInsurancePolicyStatus =
  | "pending_payment"
  | "active"
  | "expired"
  | "claimed";

export type SearchInsuranceClaimStatus =
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "paid";

export function generateSearchInsurancePolicyReference(): string {
  const rand = Math.floor(Math.random() * 1e8)
    .toString()
    .padStart(8, "0");
  return `KSI-${Date.now().toString(36).toUpperCase()}-${rand}`;
}
