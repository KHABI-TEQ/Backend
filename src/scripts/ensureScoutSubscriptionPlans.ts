/**
 * Ensures Property Scout (unlicensed Agent/Developer) Standard + Custom Domain plans exist
 * at student-oriented prices, and tags existing catalog plans as licensed-audience.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/ensureScoutSubscriptionPlans.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { DB } from "../controllers";
import {
  SCOUT_CATALOG_PRICE_MULTIPLIER,
  SCOUT_PLAN_CALLOUT,
  SCOUT_STANDARD_PLAN_NAME,
  SCOUT_STANDARD_PRICING,
  SCOUT_WHITE_LABELING_PLAN_NAME,
  SCOUT_WHITE_LABELING_PRICING,
  SUBSCRIPTION_BILLING_INTERVALS,
  SUBSCRIPTION_PLAN_AUDIENCES,
  SUBSCRIPTION_PLAN_CATEGORIES,
  WHITE_LABELING_PRICING,
  WHITE_LABELING_QUARTERLY_BENEFITS,
  WHITE_LABELING_YEARLY_BENEFITS,
  withoutRetiredStandardBenefits,
  RETIRED_STANDARD_FEATURE_KEYS,
} from "../common/constants/subscriptionCategories";
import {
  PORTFOLIO_UNLIMITED_BENEFITS,
  PUBLISHER_STANDARD_LISTING_LIMIT,
  SCOUT_PORTFOLIO_UNLIMITED_PLAN_NAME,
  SCOUT_PORTFOLIO_UNLIMITED_PRICING,
  SPECIAL_UNLIMITED_LISTINGS_PLAN_CODE,
} from "../common/constants/publisherListingLimits";

function scoutPrice(naira: number, fallback: number): number {
  const n = Number(naira);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  const scaled = n * SCOUT_CATALOG_PRICE_MULTIPLIER;
  return Math.max(1_000, Math.round(scaled / 500) * 500);
}

function withScoutCallout(benefits: string[] | undefined): string[] {
  const list = withoutRetiredStandardBenefits(benefits).filter(Boolean);
  if (!list.includes(SCOUT_PLAN_CALLOUT)) list.push(SCOUT_PLAN_CALLOUT);
  return list;
}

function cloneFeatures(
  plan: any,
  skipKeys: string[] = [],
): Array<{ feature: any; type: string; value?: number }> {
  const skip = new Set(skipKeys.map((k) => k.toUpperCase()));
  return (plan.features || [])
    .filter((f: any) => {
      const key = String(f.feature?.key || "").toUpperCase();
      return !key || !skip.has(key);
    })
    .map((f: any) => ({
      feature: f.feature?._id || f.feature,
      type: f.type,
      value: f.value,
    }));
}

async function tagLicensedAudience() {
  const result = await DB.Models.SubscriptionPlan.updateMany(
    {
      audience: { $nin: [SUBSCRIPTION_PLAN_AUDIENCES.SCOUT, SUBSCRIPTION_PLAN_AUDIENCES.DEVELOPER] },
      code: {
        $nin: [
          SCOUT_STANDARD_PRICING.monthlyCode,
          SCOUT_WHITE_LABELING_PRICING.quarterlyCode,
          SCOUT_PORTFOLIO_UNLIMITED_PRICING.monthlyCode,
        ],
      },
    },
    { $set: { audience: SUBSCRIPTION_PLAN_AUDIENCES.LICENSED } },
  );
  console.log(`Tagged ${result.modifiedCount} plan(s) as licensed audience.`);
}

async function findLicensedStandardSource() {
  return DB.Models.SubscriptionPlan.findOne({
    isActive: true,
    isTrial: { $ne: true },
    hiddenFromCatalog: { $ne: true },
    unlimitedListings: { $ne: true },
    price: { $gt: 0 },
    code: { $ne: SCOUT_STANDARD_PRICING.monthlyCode },
    $or: [
      { category: SUBSCRIPTION_PLAN_CATEGORIES.STANDARD },
      { category: { $exists: false } },
      { category: null },
    ],
    $and: [
      {
        $or: [
          { audience: SUBSCRIPTION_PLAN_AUDIENCES.LICENSED },
          { audience: { $exists: false } },
          { audience: null },
        ],
      },
    ],
  })
    .populate("features.feature")
    .sort({ price: 1 });
}

async function ensureScoutStandardPlan() {
  const source = await findLicensedStandardSource();
  const listingsFeature = await DB.Models.PlanFeature.findOne({ key: "LISTINGS" }).lean();

  const monthlyPrice = source
    ? scoutPrice(source.price, SCOUT_STANDARD_PRICING.monthly)
    : SCOUT_STANDARD_PRICING.monthly;
  const monthlyDays = source?.durationInDays || SCOUT_STANDARD_PRICING.monthlyDays;

  const sourceQuarterly = source?.discountedPlans?.find(
    (dp) => (dp.durationInDays || 0) >= 80 && (dp.durationInDays || 0) < 150,
  );
  const sourceYearly = source?.discountedPlans?.find(
    (dp) => (dp.durationInDays || 0) >= 300,
  );

  const features = source
    ? cloneFeatures(source, [...RETIRED_STANDARD_FEATURE_KEYS])
    : listingsFeature
      ? [
          {
            feature: listingsFeature._id,
            type: "count" as const,
            value: PUBLISHER_STANDARD_LISTING_LIMIT,
          },
        ]
      : [];

  const payload = {
    name: SCOUT_STANDARD_PLAN_NAME,
    code: SCOUT_STANDARD_PRICING.monthlyCode,
    price: monthlyPrice,
    currency: "NGN",
    durationInDays: monthlyDays,
    isActive: true,
    isTrial: false,
    hiddenFromCatalog: false,
    unlimitedListings: false,
    category: SUBSCRIPTION_PLAN_CATEGORIES.STANDARD,
    audience: SUBSCRIPTION_PLAN_AUDIENCES.SCOUT,
    billingInterval: SUBSCRIPTION_BILLING_INTERVALS.MONTHLY,
    benefits: withScoutCallout(source?.benefits),
    features,
    discountedPlans: [
      {
        name: `${SCOUT_STANDARD_PLAN_NAME} — Quarterly`,
        code: SCOUT_STANDARD_PRICING.quarterlyCode,
        price: scoutPrice(
          sourceQuarterly?.price ?? monthlyPrice * 3,
          SCOUT_STANDARD_PRICING.quarterly,
        ),
        durationInDays:
          sourceQuarterly?.durationInDays || SCOUT_STANDARD_PRICING.quarterlyDays,
        billingInterval: SUBSCRIPTION_BILLING_INTERVALS.QUARTERLY,
        benefits: withScoutCallout(sourceQuarterly?.benefits || source?.benefits),
      },
      {
        name: `${SCOUT_STANDARD_PLAN_NAME} — Yearly`,
        code: SCOUT_STANDARD_PRICING.yearlyCode,
        price: scoutPrice(
          sourceYearly?.price ?? monthlyPrice * 12,
          SCOUT_STANDARD_PRICING.yearly,
        ),
        durationInDays: sourceYearly?.durationInDays || SCOUT_STANDARD_PRICING.yearlyDays,
        billingInterval: SUBSCRIPTION_BILLING_INTERVALS.YEARLY,
        benefits: withScoutCallout(sourceYearly?.benefits || source?.benefits),
      },
    ],
  };

  const existing = await DB.Models.SubscriptionPlan.findOne({
    code: SCOUT_STANDARD_PRICING.monthlyCode,
  });
  if (existing) {
    Object.assign(existing, payload);
    await existing.save();
    console.log(`Updated ${SCOUT_STANDARD_PLAN_NAME} (₦${monthlyPrice.toLocaleString("en-NG")}/mo).`);
    return;
  }
  await DB.Models.SubscriptionPlan.create(payload);
  console.log(`Created ${SCOUT_STANDARD_PLAN_NAME} (₦${monthlyPrice.toLocaleString("en-NG")}/mo).`);
}

async function ensureScoutWhiteLabelingPlan() {
  const source = await DB.Models.SubscriptionPlan.findOne({
    code: WHITE_LABELING_PRICING.quarterlyCode,
  }).populate("features.feature");

  const quarterlyPrice = source
    ? scoutPrice(source.price, SCOUT_WHITE_LABELING_PRICING.quarterly)
    : SCOUT_WHITE_LABELING_PRICING.quarterly;
  const yearlySource = source?.discountedPlans?.find(
    (dp) => dp.code === WHITE_LABELING_PRICING.yearlyCode,
  );
  const yearlyPrice = yearlySource
    ? scoutPrice(yearlySource.price, SCOUT_WHITE_LABELING_PRICING.yearly)
    : SCOUT_WHITE_LABELING_PRICING.yearly;

  const listingsFeature = await DB.Models.PlanFeature.findOne({ key: "LISTINGS" }).lean();
  const wlFeatures = await DB.Models.PlanFeature.find({
    key: {
      $in: [
        "CUSTOM_DOMAIN",
        "WHITE_LABEL_BRANDING",
        "SSL_HOSTING",
        "DNS_PROVISIONING",
        "DOMAIN_GO_LIVE_SUPPORT",
        "DOMAIN_RENEWAL_REMINDERS",
        "DOMAIN_GRACE_PERIOD",
      ],
    },
  }).lean();

  const features = source
    ? cloneFeatures(source)
    : [
        ...(listingsFeature
          ? [
              {
                feature: listingsFeature._id,
                type: "count" as const,
                value: PUBLISHER_STANDARD_LISTING_LIMIT,
              },
            ]
          : []),
        ...wlFeatures.map((f) => ({
          feature: f._id,
          type: "boolean" as const,
          value: 1,
        })),
      ];

  const payload = {
    name: `${SCOUT_WHITE_LABELING_PLAN_NAME} — Quarterly`,
    code: SCOUT_WHITE_LABELING_PRICING.quarterlyCode,
    price: quarterlyPrice,
    currency: "NGN",
    durationInDays: SCOUT_WHITE_LABELING_PRICING.quarterlyDays,
    isActive: true,
    isTrial: false,
    hiddenFromCatalog: false,
    unlimitedListings: false,
    category: SUBSCRIPTION_PLAN_CATEGORIES.WHITE_LABELING,
    audience: SUBSCRIPTION_PLAN_AUDIENCES.SCOUT,
    billingInterval: SUBSCRIPTION_BILLING_INTERVALS.QUARTERLY,
    benefits: withScoutCallout(source?.benefits || [...WHITE_LABELING_QUARTERLY_BENEFITS]),
    features,
    discountedPlans: [
      {
        name: `${SCOUT_WHITE_LABELING_PLAN_NAME} — Yearly`,
        code: SCOUT_WHITE_LABELING_PRICING.yearlyCode,
        price: yearlyPrice,
        durationInDays: SCOUT_WHITE_LABELING_PRICING.yearlyDays,
        discountPercentage: SCOUT_WHITE_LABELING_PRICING.yearlyDiscountPercentage,
        billingInterval: SUBSCRIPTION_BILLING_INTERVALS.YEARLY,
        benefits: withScoutCallout(
          yearlySource?.benefits || [...WHITE_LABELING_YEARLY_BENEFITS],
        ),
      },
    ],
  };

  const existing = await DB.Models.SubscriptionPlan.findOne({
    code: SCOUT_WHITE_LABELING_PRICING.quarterlyCode,
  });
  if (existing) {
    Object.assign(existing, payload);
    await existing.save();
    console.log(
      `Updated ${SCOUT_WHITE_LABELING_PLAN_NAME} (₦${quarterlyPrice.toLocaleString("en-NG")}/qtr).`,
    );
    return;
  }
  await DB.Models.SubscriptionPlan.create(payload);
  console.log(
    `Created ${SCOUT_WHITE_LABELING_PLAN_NAME} (₦${quarterlyPrice.toLocaleString("en-NG")}/qtr).`,
  );
}

async function ensureScoutPortfolioUnlimitedPlan() {
  const source = await DB.Models.SubscriptionPlan.findOne({
    code: SPECIAL_UNLIMITED_LISTINGS_PLAN_CODE,
  }).populate("features.feature");

  const listingsFeature = await DB.Models.PlanFeature.findOne({ key: "LISTINGS" }).lean();
  const wlFeatures = await DB.Models.PlanFeature.find({
    key: {
      $in: [
        "CUSTOM_DOMAIN",
        "WHITE_LABEL_BRANDING",
        "SSL_HOSTING",
        "DNS_PROVISIONING",
        "DOMAIN_GO_LIVE_SUPPORT",
        "DOMAIN_RENEWAL_REMINDERS",
        "DOMAIN_GRACE_PERIOD",
      ],
    },
  }).lean();

  const monthlyPrice = source
    ? scoutPrice(source.price, SCOUT_PORTFOLIO_UNLIMITED_PRICING.monthly)
    : SCOUT_PORTFOLIO_UNLIMITED_PRICING.monthly;
  const quarterlySource = source?.discountedPlans?.find(
    (dp) => dp.code === "PORTFOLIO_UNLIMITED_QTR",
  );
  const annualSource = source?.discountedPlans?.find(
    (dp) => dp.code === "PORTFOLIO_UNLIMITED_ANNUAL",
  );
  const quarterlyPrice = quarterlySource
    ? scoutPrice(quarterlySource.price, SCOUT_PORTFOLIO_UNLIMITED_PRICING.quarterly)
    : SCOUT_PORTFOLIO_UNLIMITED_PRICING.quarterly;
  const annualPrice = annualSource
    ? scoutPrice(annualSource.price, SCOUT_PORTFOLIO_UNLIMITED_PRICING.annual)
    : SCOUT_PORTFOLIO_UNLIMITED_PRICING.annual;

  const features = source
    ? cloneFeatures(source)
    : [
        ...(listingsFeature
          ? [
              {
                feature: listingsFeature._id,
                type: "unlimited" as const,
                value: 0,
              },
            ]
          : []),
        ...wlFeatures.map((f) => ({
          feature: f._id,
          type: "boolean" as const,
          value: 1,
        })),
      ];

  const benefits = withScoutCallout(
    source?.benefits?.length ? source.benefits : [...PORTFOLIO_UNLIMITED_BENEFITS],
  );

  const payload = {
    name: SCOUT_PORTFOLIO_UNLIMITED_PLAN_NAME,
    code: SCOUT_PORTFOLIO_UNLIMITED_PRICING.monthlyCode,
    price: monthlyPrice,
    currency: "NGN",
    durationInDays: 30,
    isActive: true,
    isTrial: false,
    hiddenFromCatalog: true,
    unlimitedListings: true,
    category: SUBSCRIPTION_PLAN_CATEGORIES.STANDARD,
    audience: SUBSCRIPTION_PLAN_AUDIENCES.SCOUT,
    billingInterval: SUBSCRIPTION_BILLING_INTERVALS.MONTHLY,
    benefits,
    features,
    discountedPlans: [
      {
        name: `${SCOUT_PORTFOLIO_UNLIMITED_PLAN_NAME} — Quarterly`,
        code: SCOUT_PORTFOLIO_UNLIMITED_PRICING.quarterlyCode,
        price: quarterlyPrice,
        durationInDays: SCOUT_PORTFOLIO_UNLIMITED_PRICING.quarterlyDays,
        billingInterval: SUBSCRIPTION_BILLING_INTERVALS.QUARTERLY,
        benefits,
      },
      {
        name: `${SCOUT_PORTFOLIO_UNLIMITED_PLAN_NAME} — Annual`,
        code: SCOUT_PORTFOLIO_UNLIMITED_PRICING.annualCode,
        price: annualPrice,
        durationInDays: SCOUT_PORTFOLIO_UNLIMITED_PRICING.annualDays,
        billingInterval: SUBSCRIPTION_BILLING_INTERVALS.YEARLY,
        benefits,
      },
    ],
  };

  const existing = await DB.Models.SubscriptionPlan.findOne({
    code: SCOUT_PORTFOLIO_UNLIMITED_PRICING.monthlyCode,
  });
  if (existing) {
    Object.assign(existing, payload);
    await existing.save();
    console.log(
      `Updated ${SCOUT_PORTFOLIO_UNLIMITED_PLAN_NAME} (₦${monthlyPrice.toLocaleString("en-NG")}/mo).`,
    );
    return;
  }
  await DB.Models.SubscriptionPlan.create(payload);
  console.log(
    `Created ${SCOUT_PORTFOLIO_UNLIMITED_PLAN_NAME} (₦${monthlyPrice.toLocaleString("en-NG")}/mo).`,
  );
}

async function run() {
  await mongoose.connect(process.env.MONGO_URL!);
  console.log("Connected to MongoDB");
  void DB.Models.SubscriptionPlan;

  await tagLicensedAudience();
  await ensureScoutStandardPlan();
  await ensureScoutWhiteLabelingPlan();
  await ensureScoutPortfolioUnlimitedPlan();

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
