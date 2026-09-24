/** Standard cap for paid publishers on quarterly / default catalog plans. */
export const PUBLISHER_STANDARD_LISTING_LIMIT = 25;

/** Licensed Agent annual plan listing cap. */
export const PUBLISHER_ANNUAL_LISTING_LIMIT = 50;

export const LICENSED_AGENT_ANNUAL_PLAN_CODE = "LICENSED_AGENT_YEARLY";

/** @deprecated Unpaid trial listings are retired. Paid publishers use PUBLISHER_STANDARD_LISTING_LIMIT. */
export const FREE_TRIAL_LISTING_LIMIT = 0;

/** Retired Portfolio Unlimited SKUs — kept only so old records can be identified and deactivated. */
export const RETIRED_UNLIMITED_LISTINGS_PLAN_CODES = [
  "PORTFOLIO_UNLIMITED",
  "PORTFOLIO_UNLIMITED_QTR",
  "PORTFOLIO_UNLIMITED_ANNUAL",
  "SCOUT_PORTFOLIO_UNLIMITED",
  "SCOUT_PORTFOLIO_UNLIMITED_QTR",
  "SCOUT_PORTFOLIO_UNLIMITED_ANNUAL",
] as const;

/** @deprecated Portfolio Unlimited is retired. */
export const SPECIAL_UNLIMITED_LISTINGS_PLAN_CODE = "PORTFOLIO_UNLIMITED";
/** @deprecated Portfolio Unlimited is retired. */
export const SPECIAL_UNLIMITED_LISTINGS_PLAN_NAME = "Portfolio Unlimited";

export const LISTING_LIMIT_SPECIAL_PLAN_CODE = "LISTING_LIMIT_REACHED";

export function listingLimitMessage(limit: number): string {
  const extra =
    limit < PUBLISHER_ANNUAL_LISTING_LIMIT
      ? ` The annual Licensed Agent plan allows up to ${PUBLISHER_ANNUAL_LISTING_LIMIT} listings.`
      : "";
  return `You have reached the maximum of ${limit} property listings on your current plan.${extra}`;
}

export const PUBLISHER_LISTING_LIMIT_MESSAGE = listingLimitMessage(
  PUBLISHER_STANDARD_LISTING_LIMIT
);

export function listingLimitForPlanCode(
  planCode?: string | null,
  explicitLimit?: number | null
): number {
  if (explicitLimit != null && Number.isFinite(Number(explicitLimit)) && Number(explicitLimit) > 0) {
    return Number(explicitLimit);
  }
  const code = String(planCode || "").trim().toUpperCase();
  if (code === LICENSED_AGENT_ANNUAL_PLAN_CODE) {
    return PUBLISHER_ANNUAL_LISTING_LIMIT;
  }
  return PUBLISHER_STANDARD_LISTING_LIMIT;
}

/** @deprecated Portfolio Unlimited pricing is retired. */
export const PORTFOLIO_UNLIMITED_PRICING = {
  monthly: 45_000,
  quarterly: 120_000,
  quarterlyDays: 90,
  quarterlyCode: "PORTFOLIO_UNLIMITED_QTR",
  annual: 420_000,
  annualDays: 365,
  annualCode: "PORTFOLIO_UNLIMITED_ANNUAL",
} as const;

/** @deprecated */
export const SCOUT_PORTFOLIO_UNLIMITED_PLAN_NAME =
  "Portfolio Unlimited — Property Scout";

/** @deprecated */
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

/** @deprecated */
export const PORTFOLIO_UNLIMITED_BENEFITS: string[] = [];

export const PUBLISHER_USER_TYPES = ["Agent", "Developer", "Landowners", "PropertyScout"] as const;
export type PublisherUserType = (typeof PUBLISHER_USER_TYPES)[number];

export function isPublisherUserType(userType: string | undefined | null): userType is PublisherUserType {
  if (!userType) return false;
  return (PUBLISHER_USER_TYPES as readonly string[]).includes(userType);
}

/** Identifies retired Portfolio Unlimited SKUs. These no longer grant unlimited listings. */
export function isUnlimitedListingPlanCode(planCode: string | undefined | null): boolean {
  if (!planCode) return false;
  const code = planCode.trim().toUpperCase();
  return (RETIRED_UNLIMITED_LISTINGS_PLAN_CODES as readonly string[]).includes(code);
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
