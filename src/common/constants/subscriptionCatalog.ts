import {
  SUBSCRIPTION_BILLING_INTERVALS,
  SUBSCRIPTION_PLAN_AUDIENCES,
  type SubscriptionBillingInterval,
  type SubscriptionPlanAudience,
} from "./subscriptionCategories";

export const SUBSCRIPTION_CATALOG_GROUPS = {
  SERVICE_PROFESSIONAL: "service-professional",
  LICENSED: "licensed",
  SCOUT: "scout",
  DEVELOPER_DISTRIBUTION: "developer-distribution",
  DEVELOPER_OFFPLAN: "developer-offplan",
} as const;

export type SubscriptionCatalogGroupKey =
  (typeof SUBSCRIPTION_CATALOG_GROUPS)[keyof typeof SUBSCRIPTION_CATALOG_GROUPS];

export const CATALOG_PLAN_CODES = {
  SCOUT: "SCOUT_STANDARD_QTR",
  LICENSED_AGENT: "LICENSED_AGENT_QTR",
  DEV_DISTRIBUTION: "DEV_DISTRIBUTION_QTR",
  DEV_OFFPLAN: "DEV_OFFPLAN_QTR",
  DEV_OFFPLAN_YEARLY: "DEV_OFFPLAN_YEARLY",
  LAWYER: "LAWYER_QTR",
  LAWYER_YEARLY: "LAWYER_YEARLY",
  SURVEYOR: "SURVEYOR_QTR",
  SURVEYOR_YEARLY: "SURVEYOR_YEARLY",
  VALUER: "VALUER_QTR",
  VALUER_YEARLY: "VALUER_YEARLY",
} as const;

export type CatalogPlanCode =
  (typeof CATALOG_PLAN_CODES)[keyof typeof CATALOG_PLAN_CODES];

export const CATALOG_VISIBLE_PLAN_CODES: string[] = [
  CATALOG_PLAN_CODES.SCOUT,
  CATALOG_PLAN_CODES.LICENSED_AGENT,
  CATALOG_PLAN_CODES.DEV_DISTRIBUTION,
  CATALOG_PLAN_CODES.DEV_OFFPLAN,
  CATALOG_PLAN_CODES.DEV_OFFPLAN_YEARLY,
  CATALOG_PLAN_CODES.LAWYER,
  CATALOG_PLAN_CODES.SURVEYOR,
  CATALOG_PLAN_CODES.VALUER,
];

export const CATALOG_DISCOUNTED_PLAN_CODES: string[] = [
  CATALOG_PLAN_CODES.LAWYER_YEARLY,
  CATALOG_PLAN_CODES.SURVEYOR_YEARLY,
  CATALOG_PLAN_CODES.VALUER_YEARLY,
];

export const ALL_CATALOG_PLAN_CODES: string[] = [
  ...CATALOG_VISIBLE_PLAN_CODES,
  ...CATALOG_DISCOUNTED_PLAN_CODES,
];

export type CatalogBenefit = {
  title: string;
  description?: string;
};

export type CatalogBillingOption = {
  code: string;
  name: string;
  price: number;
  durationInDays: number;
  billingInterval: SubscriptionBillingInterval;
  label: string;
};

export type CatalogPlanDefinition = {
  code: string;
  name: string;
  audience: SubscriptionPlanAudience;
  group: SubscriptionCatalogGroupKey;
  price: number;
  durationInDays: number;
  billingInterval: SubscriptionBillingInterval;
  benefits: string[];
  featureDetails: CatalogBenefit[];
  designedFor: string;
  headline?: string;
  maxProfessionals?: number;
  allowsOffPlan?: boolean;
  discountedPlans?: CatalogBillingOption[];
  displayWithCode?: string;
};

export type CatalogGroupDefinition = {
  key: SubscriptionCatalogGroupKey;
  label: string;
  eyebrow: string;
  headline: string;
  tagline: string;
  designedFor: string;
  quote?: { text: string; attribution: string };
  highlights?: string[];
  registerHref: string;
  sortOrder: number;
};

export const CATALOG_GROUPS: Record<
  SubscriptionCatalogGroupKey,
  CatalogGroupDefinition
> = {
  "service-professional": {
    key: "service-professional",
    label: "Service Professionals",
    eyebrow: "Service Professionals",
    headline: "Your Expertise Matters.",
    tagline:
      "Connect with property seekers who need legal, survey and valuation services. Grow your practice with Khabiteq.",
    designedFor:
      "For lawyers, surveyors and valuers who want to make their services discoverable to verified property seekers.",
    highlights: [
      "More Clients",
      "Verified & Trusted",
      "Professional Visibility",
      "Part of a Bigger Ecosystem",
    ],
    registerHref: "/auth/register?userType=Lawyer",
    sortOrder: 1,
  },
  licensed: {
    key: "licensed",
    label: "Licensed Agent Plans",
    eyebrow: "Licensed Agent Plan",
    headline: "Grow Your Real Estate Business with Khabiteq",
    tagline:
      "Get a verified professional page, manage your listings, connect with serious property seekers and close more opportunities.",
    designedFor:
      "For licensed real estate agents. Verified. Trusted. Visible.",
    quote: {
      text: "Khabiteq has helped me connect with serious clients and close more deals. My business is more organized and professional.",
      attribution: "Licensed Agent, Lagos",
    },
    highlights: [
      "Serious Property Seekers",
      "Build Trust & Credibility",
      "Grow Your Earnings",
    ],
    registerHref: "/auth/register?userType=Agent",
    sortOrder: 2,
  },
  scout: {
    key: "scout",
    label: "Property Scout Plans",
    eyebrow: "Property Scout",
    headline: "Turn Opportunities into Income",
    tagline:
      "List properties, get connected to buyers and earn commissions with Khabiteq.",
    designedFor:
      "Designed for verified Property Scouts who want to participate in property opportunities without a real estate license.",
    quote: {
      text: "Khabiteq has made it easy for me to list properties and connect with serious clients.",
      attribution: "Property Scout, Lagos",
    },
    highlights: ["Real Opportunities", "Verified Platform", "Earn More"],
    registerHref: "/auth/register?intent=scout",
    sortOrder: 3,
  },
  "developer-distribution": {
    key: "developer-distribution",
    label: "Property Distribution Plans for Developers",
    eyebrow: "Developers / Landowners",
    headline: "Showcase. Distribute. Sell.",
    tagline:
      "Present your properties, manage who can market them, and reach serious buyers through Khabiteq's trusted network of professionals.",
    designedFor:
      "Designed for developers and property owners seeking to showcase and distribute their properties.",
    quote: {
      text: "Khabiteq has helped us reach more qualified buyers and work with trusted professionals. Our sales process is now more structured and efficient.",
      attribution: "Real Estate Developer, Lagos",
    },
    highlights: [
      "Connect with verified professionals",
      "Expand your marketing reach",
      "Stay in control of who can market",
      "Reach serious local and diaspora buyers",
      "Access transaction support tools",
    ],
    registerHref: "/auth/register?userType=Developer",
    sortOrder: 4,
  },
  "developer-offplan": {
    key: "developer-offplan",
    label: "Off-plan Plans for Developers",
    eyebrow: "Developers",
    headline: "Off-plan Plan",
    tagline:
      "Designed for developers marketing off-plan projects with wider professional distribution.",
    designedFor:
      "Designed for developers marketing off-plan projects with wider professional distribution.",
    quote: {
      text: "Khabiteq has helped us reach more qualified buyers and work with trusted professionals. Our sales process is now more structured and efficient.",
      attribution: "Real Estate Developer, Lagos",
    },
    highlights: [
      "Connect with verified professionals",
      "Expand your marketing reach",
      "Stay in control of who can market",
      "Reach serious local and diaspora buyers",
      "Access transaction support tools",
    ],
    registerHref: "/auth/register?userType=Developer",
    sortOrder: 5,
  },
};

const SERVICE_PROFESSIONAL_FEATURES: CatalogBenefit[] = [
  { title: "Professional Profile Page" },
  { title: "Client Discovery & Referrals" },
  { title: "Showcase Your Services" },
  { title: "Connect with Verified Property Seekers" },
  { title: "Platform Support" },
];

const SERVICE_PROFESSIONAL_BENEFITS = SERVICE_PROFESSIONAL_FEATURES.map(
  (f) => f.title
);

const SERVICE_YEARLY = {
  price: 130_000,
  durationInDays: 365,
  billingInterval: SUBSCRIPTION_BILLING_INTERVALS.YEARLY,
  label: "per year",
} as const;

export const CATALOG_PLANS: CatalogPlanDefinition[] = [
  {
    code: CATALOG_PLAN_CODES.SCOUT,
    name: "Property Scout",
    audience: SUBSCRIPTION_PLAN_AUDIENCES.SCOUT,
    group: "scout",
    price: 23_500,
    durationInDays: 90,
    billingInterval: SUBSCRIPTION_BILLING_INTERVALS.QUARTERLY,
    designedFor:
      "Designed for verified Property Scouts who want to participate in property opportunities without a real estate license.",
    headline: "Turn Opportunities into Income",
    featureDetails: [
      {
        title: "Professional Profile Page",
        description: "Showcase your profile and build trust",
      },
      {
        title: "List Properties",
        description: "Easily upload and manage your listings",
      },
      {
        title: "Access to Eligible Opportunities",
        description: "Get visibility to relevant buyer demand",
      },
      {
        title: "Inspection Opportunities",
        description: "Participate in scheduled inspections",
      },
      {
        title: "Platform Support",
        description: "Get help whenever you need it",
      },
    ],
    benefits: [
      "Professional Profile Page",
      "List Properties",
      "Access to Eligible Opportunities",
      "Inspection Opportunities",
      "Platform Support",
    ],
  },
  {
    code: CATALOG_PLAN_CODES.LICENSED_AGENT,
    name: "Licensed Agent Plan",
    audience: SUBSCRIPTION_PLAN_AUDIENCES.LICENSED,
    group: "licensed",
    price: 50_000,
    durationInDays: 90,
    billingInterval: SUBSCRIPTION_BILLING_INTERVALS.QUARTERLY,
    designedFor:
      "For licensed real estate agents who want a verified professional page, listings and demand matching.",
    headline: "Grow Your Real Estate Business with Khabiteq",
    featureDetails: [
      {
        title: "Verified Practitioner Page",
        description: "Showcase your license, experience, listings, reviews and contact details.",
      },
      {
        title: "Property Listing Management",
        description: "Easily create and manage your property listings.",
      },
      {
        title: "Property Demand Matching",
        description: "Get matched with genuine buyers and tenants based on their preferences.",
      },
      {
        title: "Inspection & Negotiation Tools",
        description: "Schedule inspections, manage enquiries and negotiate with confidence.",
      },
      {
        title: "Transaction Workflow Tools",
        description: "Track your deals and proceed to transaction registration.",
      },
    ],
    benefits: [
      "Verified Practitioner Page",
      "Property Listing Management",
      "Property Demand Matching",
      "Inspection & Negotiation Tools",
      "Transaction Workflow Tools",
    ],
  },
  {
    code: CATALOG_PLAN_CODES.DEV_DISTRIBUTION,
    name: "Property Distribution Plan",
    audience: SUBSCRIPTION_PLAN_AUDIENCES.DEVELOPER,
    group: "developer-distribution",
    price: 50_000,
    durationInDays: 90,
    billingInterval: SUBSCRIPTION_BILLING_INTERVALS.QUARTERLY,
    designedFor:
      "Designed for developers and property owners seeking to showcase and distribute their properties.",
    maxProfessionals: 10,
    allowsOffPlan: false,
    featureDetails: [
      { title: "Connect with verified professionals" },
      { title: "Expand your marketing reach" },
      { title: "Stay in control of who can market" },
      { title: "Reach serious local and diaspora buyers" },
      { title: "Access transaction support tools" },
    ],
    benefits: [
      "Connect with verified professionals",
      "Expand your marketing reach",
      "Stay in control of who can market",
      "Reach serious local and diaspora buyers",
      "Access transaction support tools",
    ],
  },
  {
    code: CATALOG_PLAN_CODES.DEV_OFFPLAN,
    name: "Off-plan Plan",
    audience: SUBSCRIPTION_PLAN_AUDIENCES.DEVELOPER,
    group: "developer-offplan",
    price: 130_000,
    durationInDays: 90,
    billingInterval: SUBSCRIPTION_BILLING_INTERVALS.QUARTERLY,
    designedFor:
      "Designed for developers marketing off-plan projects with wider professional distribution.",
    maxProfessionals: 30,
    allowsOffPlan: true,
    featureDetails: [
      { title: "Connect with verified professionals" },
      { title: "Expand your marketing reach" },
      { title: "Stay in control of who can market" },
      { title: "Reach serious local and diaspora buyers" },
      { title: "Access transaction support tools" },
    ],
    benefits: [
      "Connect with verified professionals",
      "Expand your marketing reach",
      "Stay in control of who can market",
      "Reach serious local and diaspora buyers",
      "Access transaction support tools",
    ],
  },
  {
    code: CATALOG_PLAN_CODES.DEV_OFFPLAN_YEARLY,
    name: "Off-plan Plan",
    audience: SUBSCRIPTION_PLAN_AUDIENCES.DEVELOPER,
    group: "developer-offplan",
    price: 390_000,
    durationInDays: 365,
    billingInterval: SUBSCRIPTION_BILLING_INTERVALS.YEARLY,
    designedFor:
      "Designed for developers marketing off-plan projects with wider professional distribution.",
    maxProfessionals: 100,
    allowsOffPlan: true,
    displayWithCode: CATALOG_PLAN_CODES.DEV_OFFPLAN,
    featureDetails: [
      { title: "Connect with verified professionals" },
      { title: "Expand your marketing reach" },
      { title: "Stay in control of who can market" },
      { title: "Reach serious local and diaspora buyers" },
      { title: "Access transaction support tools" },
    ],
    benefits: [
      "Connect with verified professionals",
      "Expand your marketing reach",
      "Stay in control of who can market",
      "Reach serious local and diaspora buyers",
      "Access transaction support tools",
    ],
  },
  {
    code: CATALOG_PLAN_CODES.LAWYER,
    name: "Lawyers",
    audience: SUBSCRIPTION_PLAN_AUDIENCES.LAWYER,
    group: "service-professional",
    price: 50_000,
    durationInDays: 90,
    billingInterval: SUBSCRIPTION_BILLING_INTERVALS.QUARTERLY,
    designedFor: "Make your property and legal services discoverable.",
    featureDetails: SERVICE_PROFESSIONAL_FEATURES,
    benefits: SERVICE_PROFESSIONAL_BENEFITS,
    discountedPlans: [
      {
        code: CATALOG_PLAN_CODES.LAWYER_YEARLY,
        name: "Lawyers — Yearly",
        ...SERVICE_YEARLY,
      },
    ],
  },
  {
    code: CATALOG_PLAN_CODES.SURVEYOR,
    name: "Surveyors",
    audience: SUBSCRIPTION_PLAN_AUDIENCES.SURVEYOR,
    group: "service-professional",
    price: 50_000,
    durationInDays: 90,
    billingInterval: SUBSCRIPTION_BILLING_INTERVALS.QUARTERLY,
    designedFor:
      "Connecting with property seekers who need survey and site services.",
    featureDetails: SERVICE_PROFESSIONAL_FEATURES,
    benefits: SERVICE_PROFESSIONAL_BENEFITS,
    discountedPlans: [
      {
        code: CATALOG_PLAN_CODES.SURVEYOR_YEARLY,
        name: "Surveyors — Yearly",
        ...SERVICE_YEARLY,
      },
    ],
  },
  {
    code: CATALOG_PLAN_CODES.VALUER,
    name: "Valuers",
    audience: SUBSCRIPTION_PLAN_AUDIENCES.VALUER,
    group: "service-professional",
    price: 50_000,
    durationInDays: 90,
    billingInterval: SUBSCRIPTION_BILLING_INTERVALS.QUARTERLY,
    designedFor:
      "Make valuation services discoverable when independent valuation is required.",
    featureDetails: SERVICE_PROFESSIONAL_FEATURES,
    benefits: SERVICE_PROFESSIONAL_BENEFITS,
    discountedPlans: [
      {
        code: CATALOG_PLAN_CODES.VALUER_YEARLY,
        name: "Valuers — Yearly",
        ...SERVICE_YEARLY,
      },
    ],
  },
];

const CATALOG_CODE_SET = new Set(ALL_CATALOG_PLAN_CODES);

export function isCatalogPlanCode(planCode?: string | null): boolean {
  if (!planCode) return false;
  return CATALOG_CODE_SET.has(planCode.trim().toUpperCase());
}

export function catalogDefinitionByCode(
  planCode?: string | null
): CatalogPlanDefinition | undefined {
  if (!planCode) return undefined;
  const code = planCode.trim().toUpperCase();
  return CATALOG_PLANS.find(
    (plan) =>
      plan.code === code ||
      plan.discountedPlans?.some((dp) => dp.code === code)
  );
}

export function catalogGroupForAudience(
  audience?: string | null
): SubscriptionCatalogGroupKey {
  switch (audience) {
    case SUBSCRIPTION_PLAN_AUDIENCES.SCOUT:
      return "scout";
    case SUBSCRIPTION_PLAN_AUDIENCES.DEVELOPER:
      return "developer-distribution";
    case SUBSCRIPTION_PLAN_AUDIENCES.LAWYER:
    case SUBSCRIPTION_PLAN_AUDIENCES.SURVEYOR:
    case SUBSCRIPTION_PLAN_AUDIENCES.VALUER:
      return "service-professional";
    default:
      return "licensed";
  }
}

export function catalogGroupForUserType(
  userType?: string | null
): SubscriptionCatalogGroupKey | null {
  const t = String(userType || "").trim();
  if (t === "PropertyScout") return "scout";
  if (t === "Developer" || t === "Landowners") return "developer-distribution";
  if (t === "Lawyer" || t === "Surveyor" || t === "Valuer") {
    return "service-professional";
  }
  if (t === "Agent") return "licensed";
  return null;
}

export function catalogGroupKeysForUserType(
  userType?: string | null
): SubscriptionCatalogGroupKey[] {
  const t = String(userType || "").trim();
  if (t === "Landowners") {
    return ["developer-distribution"];
  }
  if (t === "Developer") {
    return ["developer-distribution", "developer-offplan"];
  }
  const single = catalogGroupForUserType(userType);
  return single ? [single] : [];
}

export function registerHrefForAudience(audience?: string | null): string {
  switch (audience) {
    case SUBSCRIPTION_PLAN_AUDIENCES.SCOUT:
      return "/auth/register?intent=scout";
    case SUBSCRIPTION_PLAN_AUDIENCES.DEVELOPER:
      return "/auth/register?userType=Developer";
    case SUBSCRIPTION_PLAN_AUDIENCES.LAWYER:
      return "/auth/register?userType=Lawyer";
    case SUBSCRIPTION_PLAN_AUDIENCES.SURVEYOR:
      return "/auth/register?userType=Surveyor";
    case SUBSCRIPTION_PLAN_AUDIENCES.VALUER:
      return "/auth/register?userType=Valuer";
    default:
      return "/auth/register?userType=Agent";
  }
}
