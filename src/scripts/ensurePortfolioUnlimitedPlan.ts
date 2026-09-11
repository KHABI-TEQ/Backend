/**
 * Ensures Portfolio Unlimited exists and aligns LISTINGS features:
 * - Free / trial plans → 10
 * - Paid Premium catalog plans → 25
 * - Portfolio Unlimited → unlimited listings + custom domain / white-labeling
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/ensurePortfolioUnlimitedPlan.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { DB } from "../controllers";
import {
  FREE_TRIAL_LISTING_LIMIT,
  PORTFOLIO_UNLIMITED_BENEFITS,
  PORTFOLIO_UNLIMITED_PRICING,
  PUBLISHER_STANDARD_LISTING_LIMIT,
  SCOUT_PORTFOLIO_UNLIMITED_PRICING,
  SPECIAL_UNLIMITED_LISTINGS_PLAN_CODE,
  SPECIAL_UNLIMITED_LISTINGS_PLAN_NAME,
} from "../common/constants/publisherListingLimits";
import {
  SUBSCRIPTION_PLAN_AUDIENCES,
  WHITE_LABELING_FEATURE_KEYS,
  withoutRetiredStandardBenefits,
} from "../common/constants/subscriptionCategories";

async function getListingsFeatureId(): Promise<string | null> {
  const feature = await DB.Models.PlanFeature.findOne({ key: "LISTINGS" }).lean();
  return feature?._id?.toString() ?? null;
}

async function ensureWhiteLabelingFeatureIds(): Promise<string[]> {
  const ids: string[] = [];
  for (const feature of WHITE_LABELING_FEATURE_KEYS) {
    const existing = await DB.Models.PlanFeature.findOne({ key: feature.key });
    if (existing) {
      ids.push(String(existing._id));
      continue;
    }
    const created = await DB.Models.PlanFeature.create({
      key: feature.key,
      label: feature.label,
      isActive: true,
    });
    ids.push(String(created._id));
  }
  return ids;
}

function isFreeOrTrialPlan(plan: {
  isTrial?: boolean;
  price?: number;
  name?: string;
}): boolean {
  return (
    !!plan.isTrial ||
    Number(plan.price) === 0 ||
    /free/i.test(String(plan.name || ""))
  );
}

function portfolioUnlimitedFeatures(
  listingsFeatureId: string,
  whiteLabelFeatureIds: string[]
) {
  return [
    {
      feature: listingsFeatureId,
      type: "unlimited" as const,
      value: 0,
    },
    ...whiteLabelFeatureIds.map((id) => ({
      feature: id,
      type: "boolean" as const,
      value: 1,
    })),
  ];
}

async function ensurePortfolioUnlimitedPlan(
  listingsFeatureId: string,
  whiteLabelFeatureIds: string[]
) {
  const existing = await DB.Models.SubscriptionPlan.findOne({
    code: SPECIAL_UNLIMITED_LISTINGS_PLAN_CODE,
  });

  const payload = {
    name: SPECIAL_UNLIMITED_LISTINGS_PLAN_NAME,
    code: SPECIAL_UNLIMITED_LISTINGS_PLAN_CODE,
    price: PORTFOLIO_UNLIMITED_PRICING.monthly,
    currency: "NGN",
    durationInDays: 30,
    isActive: true,
    isTrial: false,
    hiddenFromCatalog: true,
    unlimitedListings: true,
    category: "standard" as const,
    audience: SUBSCRIPTION_PLAN_AUDIENCES.LICENSED,
    billingInterval: "monthly" as const,
    benefits: [...PORTFOLIO_UNLIMITED_BENEFITS],
    features: portfolioUnlimitedFeatures(listingsFeatureId, whiteLabelFeatureIds),
    discountedPlans: [
      {
        name: `${SPECIAL_UNLIMITED_LISTINGS_PLAN_NAME} — Quarterly`,
        code: PORTFOLIO_UNLIMITED_PRICING.quarterlyCode,
        price: PORTFOLIO_UNLIMITED_PRICING.quarterly,
        durationInDays: PORTFOLIO_UNLIMITED_PRICING.quarterlyDays,
        discountPercentage: 11,
        billingInterval: "quarterly" as const,
        benefits: [...PORTFOLIO_UNLIMITED_BENEFITS],
      },
      {
        name: `${SPECIAL_UNLIMITED_LISTINGS_PLAN_NAME} — Annual`,
        code: PORTFOLIO_UNLIMITED_PRICING.annualCode,
        price: PORTFOLIO_UNLIMITED_PRICING.annual,
        durationInDays: PORTFOLIO_UNLIMITED_PRICING.annualDays,
        discountPercentage: 22,
        billingInterval: "yearly" as const,
        benefits: [...PORTFOLIO_UNLIMITED_BENEFITS],
      },
    ],
  };

  if (existing) {
    Object.assign(existing, payload);
    await existing.save();
    console.log(`Updated ${SPECIAL_UNLIMITED_LISTINGS_PLAN_NAME} plan.`);
    return;
  }

  await DB.Models.SubscriptionPlan.create(payload);
  console.log(`Created ${SPECIAL_UNLIMITED_LISTINGS_PLAN_NAME} plan.`);
}

async function stripRetiredStandardBenefits() {
  const plans = await DB.Models.SubscriptionPlan.find({
    unlimitedListings: { $ne: true },
    category: { $ne: "white-labeling" },
  });

  let updated = 0;
  for (const plan of plans) {
    let changed = false;
    const next = withoutRetiredStandardBenefits(plan.benefits);
    if (next.length !== (plan.benefits || []).length) {
      plan.benefits = next;
      changed = true;
    }
    for (const dp of plan.discountedPlans || []) {
      const dpNext = withoutRetiredStandardBenefits(dp.benefits);
      if (dpNext.length !== (dp.benefits || []).length) {
        dp.benefits = dpNext;
        changed = true;
      }
    }
    if (changed) {
      await plan.save();
      updated += 1;
    }
  }
  console.log(`Stripped retired Standard benefits from ${updated} plan(s).`);
}

async function alignCatalogListingCaps(listingsFeatureId: string) {
  const plans = await DB.Models.SubscriptionPlan.find({
    code: {
      $nin: [
        SPECIAL_UNLIMITED_LISTINGS_PLAN_CODE,
        SCOUT_PORTFOLIO_UNLIMITED_PRICING.monthlyCode,
      ],
    },
    unlimitedListings: { $ne: true },
    category: { $ne: "white-labeling" },
  }).populate("features.feature");

  let freeUpdated = 0;
  let premiumUpdated = 0;

  for (const plan of plans) {
    const target = isFreeOrTrialPlan(plan)
      ? FREE_TRIAL_LISTING_LIMIT
      : PUBLISHER_STANDARD_LISTING_LIMIT;
    let changed = false;

    for (const assigned of plan.features) {
      const featureDoc = assigned.feature as
        | { key?: string; _id?: { toString(): string } }
        | null;
      const isListings =
        featureDoc?.key === "LISTINGS" ||
        featureDoc?._id?.toString() === listingsFeatureId;
      if (!isListings) continue;

      if (assigned.type === "unlimited") {
        assigned.type = "count";
        assigned.value = target;
        changed = true;
      } else if (assigned.type === "count" && assigned.value !== target) {
        assigned.value = target;
        changed = true;
      }
    }

    if (changed) {
      await plan.save();
      if (target === FREE_TRIAL_LISTING_LIMIT) freeUpdated += 1;
      else premiumUpdated += 1;
    }
  }

  console.log(
    `Aligned LISTINGS: Free/trial → ${FREE_TRIAL_LISTING_LIMIT} (${freeUpdated} plan(s)); Premium → ${PUBLISHER_STANDARD_LISTING_LIMIT} (${premiumUpdated} plan(s)).`
  );
}

async function run() {
  await mongoose.connect(process.env.MONGO_URL!);
  console.log("Connected to MongoDB");

  const listingsFeatureId = await getListingsFeatureId();
  if (!listingsFeatureId) {
    throw new Error("LISTINGS PlanFeature not found. Seed plan features first.");
  }

  const whiteLabelFeatureIds = await ensureWhiteLabelingFeatureIds();
  await ensurePortfolioUnlimitedPlan(listingsFeatureId, whiteLabelFeatureIds);
  await alignCatalogListingCaps(listingsFeatureId);
  await stripRetiredStandardBenefits();

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
