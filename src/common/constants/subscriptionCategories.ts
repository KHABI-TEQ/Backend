import {
  PUBLISHER_STANDARD_LISTING_LIMIT,
  SCOUT_PORTFOLIO_UNLIMITED_PRICING,
} from "./publisherListingLimits";

/**
 * Subscription catalog categories.
 * - standard: practitioner listing packages only
 * - white-labeling: practitioner listing eligibility + custom domain / white-label
 */
export const SUBSCRIPTION_PLAN_CATEGORIES = {
  STANDARD: "standard",
  WHITE_LABELING: "white-labeling",
} as const;

export type SubscriptionPlanCategory =
  (typeof SUBSCRIPTION_PLAN_CATEGORIES)[keyof typeof SUBSCRIPTION_PLAN_CATEGORIES];

export const SUBSCRIPTION_PLAN_CATEGORY_LABELS: Record<
  SubscriptionPlanCategory,
  string
> = {
  [SUBSCRIPTION_PLAN_CATEGORIES.STANDARD]: "Standard",
  [SUBSCRIPTION_PLAN_CATEGORIES.WHITE_LABELING]:
    "Custom Domain / White Labeling",
};

export const SUBSCRIPTION_BILLING_INTERVALS = {
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
  HALF_YEARLY: "half-yearly",
  YEARLY: "yearly",
} as const;

export type SubscriptionBillingInterval =
  (typeof SUBSCRIPTION_BILLING_INTERVALS)[keyof typeof SUBSCRIPTION_BILLING_INTERVALS];

export const SUBSCRIPTION_BILLING_INTERVAL_LABELS: Record<
  SubscriptionBillingInterval,
  string
> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  "half-yearly": "Half-yearly",
  yearly: "Yearly",
};

export const WHITE_LABELING_ALLOWED_INTERVALS: SubscriptionBillingInterval[] = [
  SUBSCRIPTION_BILLING_INTERVALS.QUARTERLY,
  SUBSCRIPTION_BILLING_INTERVALS.YEARLY,
];

export const WHITE_LABELING_PLAN_NAME = "Custom Domain / White Labeling";

export const WHITE_LABELING_PRICING = {
  quarterly: 40_000,
  quarterlyDays: 90,
  quarterlyCode: "WHITE_LABELING_QTR",
  yearly: 140_000,
  yearlyDays: 365,
  yearlyCode: "WHITE_LABELING_YEARLY",
  yearlyDiscountPercentage: 13,
} as const;

export const WHITE_LABELING_FEATURE_KEYS = [
  { key: "CUSTOM_DOMAIN", label: "Custom domain connected to your public page" },
  { key: "WHITE_LABEL_BRANDING", label: "White-labeled branding (your domain, not khabiteq.com)" },
  { key: "SSL_HOSTING", label: "SSL certificate and HTTPS hosting" },
  { key: "DNS_PROVISIONING", label: "DNS setup and technical domain provisioning" },
  { key: "DOMAIN_GO_LIVE_SUPPORT", label: "Go-live support after payment" },
  { key: "DOMAIN_RENEWAL_REMINDERS", label: "Renewal reminders before expiry" },
  { key: "DOMAIN_GRACE_PERIOD", label: "Grace period after expiry to renew without immediate downtime" },
] as const;

const WHITE_LABELING_CORE_BENEFITS = [
  "Practitioner listing eligibility (same listing access as a Standard paid plan)",
  `Up to ${PUBLISHER_STANDARD_LISTING_LIMIT} property listings on Khabiteq`,
  "Your own custom domain on your public page (not a khabiteq.com subdomain)",
  "White-labeled branding for clients visiting your listings and profile",
  "SSL certificate and HTTPS hosting included",
  "DNS setup and technical domain provisioning by Khabiteq",
  "Go-live support from the tech team after payment",
  "Renewal reminders before your domain expires",
  "Grace period after expiry so you can renew without immediate downtime",
  "Your khabiteq.com page stays available as a fallback",
] as const;

export const WHITE_LABELING_QUARTERLY_BENEFITS: string[] = [
  ...WHITE_LABELING_CORE_BENEFITS,
  "3 months of custom domain / white-label hosting",
];

export const WHITE_LABELING_YEARLY_BENEFITS: string[] = [
  ...WHITE_LABELING_CORE_BENEFITS,
  "12 months of custom domain / white-label hosting",
  "Better value than paying quarterly",
];

/** Who a catalog plan is sold to. Licensed = Agent with a license on KYC. */
export const SUBSCRIPTION_PLAN_AUDIENCES = {
  LICENSED: "licensed",
  SCOUT: "scout",
  DEVELOPER: "developer",
  LAWYER: "lawyer",
  SURVEYOR: "surveyor",
  VALUER: "valuer",
} as const;

export type SubscriptionPlanAudience =
  (typeof SUBSCRIPTION_PLAN_AUDIENCES)[keyof typeof SUBSCRIPTION_PLAN_AUDIENCES];

export const SUBSCRIPTION_PLAN_AUDIENCE_LABELS: Record<
  SubscriptionPlanAudience,
  string
> = {
  licensed: "Licensed Agent",
  scout: "Property Scout",
  developer: "Developer / Landowner",
  lawyer: "Lawyer",
  surveyor: "Surveyor",
  valuer: "Valuer",
};

export const SCOUT_STANDARD_PLAN_NAME = "Property Scout";

/** Public Property Scout catalog — ₦23,500 / 3 months. */
export const SCOUT_STANDARD_PRICING = {
  monthly: 8_000,
  monthlyDays: 30,
  monthlyCode: "SCOUT_STANDARD",
  quarterly: 23_500,
  quarterlyDays: 90,
  quarterlyCode: "SCOUT_STANDARD_QTR",
  yearly: 72_000,
  yearlyDays: 365,
  yearlyCode: "SCOUT_STANDARD_YEARLY",
} as const;

export const SCOUT_WHITE_LABELING_PLAN_NAME =
  "Custom Domain / White Labeling — Property Scout";

/** ~50% of licensed Custom Domain pricing (₦40k / ₦140k). */
export const SCOUT_WHITE_LABELING_PRICING = {
  quarterly: 20_000,
  quarterlyDays: 90,
  quarterlyCode: "SCOUT_WHITE_LABELING_QTR",
  yearly: 70_000,
  yearlyDays: 365,
  yearlyCode: "SCOUT_WHITE_LABELING_YEARLY",
  yearlyDiscountPercentage: 13,
} as const;

export const SCOUT_CATALOG_PRICE_MULTIPLIER = 0.5;

export const SCOUT_PLAN_CALLOUT =
  "Priced for Property Scouts — students and practitioners without a license.";

export const DEVELOPER_DISTRIBUTION_PLAN_NAME = "Property Distribution Plan";
export const DEVELOPER_OFFPLAN_PLAN_NAME = "Off-plan Plan";
export const DEVELOPER_OFFPLAN_ANNUAL_PLAN_NAME = "Off-plan Plan";

export const DEVELOPER_PLAN_PRICING = {
  distribution: 50_000,
  distributionDays: 90,
  distributionCode: "DEV_DISTRIBUTION_QTR",
  distributionProfessionals: 10,
  offPlan: 130_000,
  offPlanDays: 90,
  offPlanCode: "DEV_OFFPLAN_QTR",
  offPlanProfessionals: 30,
  offPlanAnnual: 390_000,
  offPlanAnnualDays: 365,
  offPlanAnnualCode: "DEV_OFFPLAN_YEARLY",
  offPlanAnnualProfessionals: 100,
} as const;

export const DEVELOPER_DISTRIBUTION_BENEFITS = [
  "Connect with verified professionals",
  "Expand your marketing reach",
  "Stay in control of who can market",
  "Reach serious local and diaspora buyers",
  "Access transaction support tools",
];

export const DEVELOPER_OFFPLAN_BENEFITS = [
  "Connect with verified professionals",
  "Expand your marketing reach",
  "Stay in control of who can market",
  "Reach serious local and diaspora buyers",
  "Access transaction support tools",
];

export const DEVELOPER_OFFPLAN_ANNUAL_BENEFITS = [
  "Connect with verified professionals",
  "Expand your marketing reach",
  "Stay in control of who can market",
  "Reach serious local and diaspora buyers",
  "Access transaction support tools",
];

export function isDeveloperPlanCode(planCode: string | undefined | null): boolean {
  if (!planCode) return false;
  const code = planCode.trim().toUpperCase();
  return (
    code === DEVELOPER_PLAN_PRICING.distributionCode ||
    code === DEVELOPER_PLAN_PRICING.offPlanCode ||
    code === DEVELOPER_PLAN_PRICING.offPlanAnnualCode
  );
}

export function isSubscriptionPlanAudience(
  value: unknown
): value is SubscriptionPlanAudience {
  return (
    value === SUBSCRIPTION_PLAN_AUDIENCES.LICENSED ||
    value === SUBSCRIPTION_PLAN_AUDIENCES.SCOUT ||
    value === SUBSCRIPTION_PLAN_AUDIENCES.DEVELOPER ||
    value === SUBSCRIPTION_PLAN_AUDIENCES.LAWYER ||
    value === SUBSCRIPTION_PLAN_AUDIENCES.SURVEYOR ||
    value === SUBSCRIPTION_PLAN_AUDIENCES.VALUER
  );
}

export function resolvePlanAudience(
  value: unknown
): SubscriptionPlanAudience {
  if (isSubscriptionPlanAudience(value)) return value;
  return SUBSCRIPTION_PLAN_AUDIENCES.LICENSED;
}

export function audienceLabel(audience: unknown): string {
  return SUBSCRIPTION_PLAN_AUDIENCE_LABELS[resolvePlanAudience(audience)];
}

export function isScoutPlanCode(planCode: string | undefined | null): boolean {
  if (!planCode) return false;
  const code = planCode.trim().toUpperCase();
  return (
    code === SCOUT_STANDARD_PRICING.monthlyCode ||
    code === SCOUT_STANDARD_PRICING.quarterlyCode ||
    code === SCOUT_STANDARD_PRICING.yearlyCode ||
    code === SCOUT_WHITE_LABELING_PRICING.quarterlyCode ||
    code === SCOUT_WHITE_LABELING_PRICING.yearlyCode ||
    code === SCOUT_PORTFOLIO_UNLIMITED_PRICING.monthlyCode ||
    code === SCOUT_PORTFOLIO_UNLIMITED_PRICING.quarterlyCode ||
    code === SCOUT_PORTFOLIO_UNLIMITED_PRICING.annualCode
  );
}

/** Standard catalog benefits/features retired from sale copy. */
export const RETIRED_STANDARD_FEATURE_KEYS = [
  "AUTOMATIC_PUSHUP",
  "SOCIAL_MEDIA_ADS",
] as const;

const RETIRED_STANDARD_BENEFIT_PATTERNS = [
  /automatic\s*push[-\s]?up/i,
  /listings?\s+refreshed/i,
  /social\s*media\s*advertising/i,
];

export function isRetiredStandardBenefit(text: string | undefined | null): boolean {
  const value = String(text || "").trim();
  if (!value) return false;
  return RETIRED_STANDARD_BENEFIT_PATTERNS.some((re) => re.test(value));
}

export function isRetiredStandardFeatureKey(
  key: string | undefined | null
): boolean {
  const k = String(key || "").trim().toUpperCase();
  return (RETIRED_STANDARD_FEATURE_KEYS as readonly string[]).includes(k);
}

export function withoutRetiredStandardBenefits(
  benefits: string[] | undefined | null
): string[] {
  return (benefits || []).filter(
    (b) => !isRetiredStandardBenefit(b)
  );
}

export function isSubscriptionPlanCategory(
  value: unknown
): value is SubscriptionPlanCategory {
  return (
    value === SUBSCRIPTION_PLAN_CATEGORIES.STANDARD ||
    value === SUBSCRIPTION_PLAN_CATEGORIES.WHITE_LABELING
  );
}

export function isWhiteLabelingCategory(value: unknown): boolean {
  return value === SUBSCRIPTION_PLAN_CATEGORIES.WHITE_LABELING;
}

export function isWhiteLabelingPlanCode(
  planCode: string | undefined | null
): boolean {
  if (!planCode) return false;
  const code = planCode.trim().toUpperCase();
  return (
    code === WHITE_LABELING_PRICING.quarterlyCode ||
    code === WHITE_LABELING_PRICING.yearlyCode ||
    code === SCOUT_WHITE_LABELING_PRICING.quarterlyCode ||
    code === SCOUT_WHITE_LABELING_PRICING.yearlyCode
  );
}

export function resolvePlanCategory(
  value: unknown
): SubscriptionPlanCategory {
  if (isSubscriptionPlanCategory(value)) return value;
  return SUBSCRIPTION_PLAN_CATEGORIES.STANDARD;
}

export function categoryLabel(category: unknown): string {
  return SUBSCRIPTION_PLAN_CATEGORY_LABELS[resolvePlanCategory(category)];
}

export function resolveBillingIntervalFromDuration(
  durationInDays?: number
): SubscriptionBillingInterval | null {
  if (durationInDays == null || !Number.isFinite(durationInDays)) return null;
  if (durationInDays >= 300) return SUBSCRIPTION_BILLING_INTERVALS.YEARLY;
  if (durationInDays >= 150) return SUBSCRIPTION_BILLING_INTERVALS.HALF_YEARLY;
  if (durationInDays >= 80) return SUBSCRIPTION_BILLING_INTERVALS.QUARTERLY;
  if (durationInDays >= 20) return SUBSCRIPTION_BILLING_INTERVALS.MONTHLY;
  return null;
}

export function isWhiteLabelingInterval(
  interval: SubscriptionBillingInterval | null | undefined,
  durationInDays?: number
): boolean {
  const resolved =
    interval || resolveBillingIntervalFromDuration(durationInDays);
  return (
    resolved === SUBSCRIPTION_BILLING_INTERVALS.QUARTERLY ||
    resolved === SUBSCRIPTION_BILLING_INTERVALS.YEARLY
  );
}

export function assertWhiteLabelingBillingInterval(input: {
  billingInterval?: string;
  durationInDays?: number;
  label?: string;
}): void {
  const interval = input.billingInterval as SubscriptionBillingInterval | undefined;
  if (!isWhiteLabelingInterval(interval, input.durationInDays)) {
    const where = input.label ? ` (${input.label})` : "";
    throw new Error(
      `Custom Domain / White Labeling plans only support quarterly and yearly billing${where}.`
    );
  }
}
