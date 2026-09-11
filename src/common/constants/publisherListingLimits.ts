/** Standard cap for paid Premium publishers (Agents, Developers, Landlords) without Portfolio Unlimited. */
export const PUBLISHER_STANDARD_LISTING_LIMIT = 25;

/** Free / trial plan listing cap (Agents without a paid subscription during the trial window). */
export const FREE_TRIAL_LISTING_LIMIT = 10;

/** Hidden catalog plan — unlimited listings; surfaced only at the 26th listing attempt. */
export const SPECIAL_UNLIMITED_LISTINGS_PLAN_CODE = "PORTFOLIO_UNLIMITED";
export const SPECIAL_UNLIMITED_LISTINGS_PLAN_NAME = "Portfolio Unlimited";

export const LISTING_LIMIT_SPECIAL_PLAN_CODE = "LISTING_LIMIT_SPECIAL_PLAN";

export const PUBLISHER_LISTING_LIMIT_MESSAGE = `You have reached the maximum of ${PUBLISHER_STANDARD_LISTING_LIMIT} property listings. Upgrade to the ${SPECIAL_UNLIMITED_LISTINGS_PLAN_NAME} plan to list without limits.`;

/** Licensed Agent / Developer Portfolio Unlimited (NGN). */
export const PORTFOLIO_UNLIMITED_PRICING = {
  monthly: 45_000,
  quarterly: 120_000,
  quarterlyDays: 90,
  quarterlyCode: "PORTFOLIO_UNLIMITED_QTR",
  annual: 420_000,
  annualDays: 365,
  annualCode: "PORTFOLIO_UNLIMITED_ANNUAL",
} as const;

export const SCOUT_PORTFOLIO_UNLIMITED_PLAN_NAME =
  "Portfolio Unlimited — Property Scout";

/**
 * Property Scout Portfolio Unlimited — 50% of licensed PU
 * (same ratio as Standard and Custom Domain / White Labeling).
 * Licensed ₦45k / ₦120k / ₦420k → Scout ₦22,500 / ₦60,000 / ₦210,000.
 */
export const SCOUT_PORTFOLIO_UNLIMITED_PRICING = {
  monthly: 22_500,
  monthlyCode: "SCOUT_PORTFOLIO_UNLIMITED",
  quarterly: 60_000,
  quarterlyDays: 90,
  quarterlyCode: "SCOUT_PORTFOLIO_UNLIMITED_QTR",
  annual: 210_000,
  annualDays: 365,
  annualCode: "SCOUT_PORTFOLIO_UNLIMITED_ANNUAL",
} as const;

export const PORTFOLIO_UNLIMITED_BENEFITS: string[] = [
  "Unlimited property listings — lifts the Premium 25-listing cap",
  "Custom domain / white-labeling included (preferred domain, branding, SSL, DNS)",
  "Your public page can go live on your own domain, not a khabiteq.com subdomain",
  "Keep posting as your portfolio grows",
  "Practitioner listing eligibility while the plan is active",
];

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
    code === PORTFOLIO_UNLIMITED_PRICING.annualCode ||
    code === SCOUT_PORTFOLIO_UNLIMITED_PRICING.monthlyCode ||
    code === SCOUT_PORTFOLIO_UNLIMITED_PRICING.quarterlyCode ||
    code === SCOUT_PORTFOLIO_UNLIMITED_PRICING.annualCode
  );
}

export function isScoutUnlimitedListingPlanCode(
  planCode: string | undefined | null
): boolean {
  if (!planCode) return false;
  const code = planCode.trim().toUpperCase();
  return (
    code === SCOUT_PORTFOLIO_UNLIMITED_PRICING.monthlyCode ||
    code === SCOUT_PORTFOLIO_UNLIMITED_PRICING.quarterlyCode ||
    code === SCOUT_PORTFOLIO_UNLIMITED_PRICING.annualCode
  );
}
