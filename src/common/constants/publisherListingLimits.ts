/** Standard cap for Landlords, Agents, and Developers without the unlimited portfolio plan. */
export const PUBLISHER_STANDARD_LISTING_LIMIT = 25;

/** Hidden catalog plan — unlimited listings; surfaced only at the 26th listing attempt. */
export const SPECIAL_UNLIMITED_LISTINGS_PLAN_CODE = "PORTFOLIO_UNLIMITED";
export const SPECIAL_UNLIMITED_LISTINGS_PLAN_NAME = "Portfolio Unlimited";

export const LISTING_LIMIT_SPECIAL_PLAN_CODE = "LISTING_LIMIT_SPECIAL_PLAN";

export const PUBLISHER_LISTING_LIMIT_MESSAGE = `You have reached the maximum of ${PUBLISHER_STANDARD_LISTING_LIMIT} property listings. Upgrade to the ${SPECIAL_UNLIMITED_LISTINGS_PLAN_NAME} plan to list without limits.`;

/** Recommended pricing (NGN) when seeding the special plan — ~2.5× a typical practitioner monthly plan. */
export const PORTFOLIO_UNLIMITED_PRICING = {
  monthly: 45_000,
  quarterly: 120_000,
  quarterlyDays: 90,
  quarterlyCode: "PORTFOLIO_UNLIMITED_QTR",
  annual: 420_000,
  annualDays: 365,
  annualCode: "PORTFOLIO_UNLIMITED_ANNUAL",
} as const;

export const PUBLISHER_USER_TYPES = ["Agent", "Developer", "Landowners"] as const;
export type PublisherUserType = (typeof PUBLISHER_USER_TYPES)[number];

export function isPublisherUserType(userType: string | undefined | null): userType is PublisherUserType {
  if (!userType) return false;
  return (PUBLISHER_USER_TYPES as readonly string[]).includes(userType);
}

export function isUnlimitedListingPlanCode(planCode: string | undefined | null): boolean {
  if (!planCode) return false;
  const code = planCode.trim().toUpperCase();
  return (
    code === SPECIAL_UNLIMITED_LISTINGS_PLAN_CODE ||
    code === PORTFOLIO_UNLIMITED_PRICING.quarterlyCode ||
    code === PORTFOLIO_UNLIMITED_PRICING.annualCode
  );
}
