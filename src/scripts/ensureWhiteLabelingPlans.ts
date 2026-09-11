/**
 * Ensures Custom Domain / White Labeling subscription plans exist,
 * tags existing catalog plans as Standard, and persists listed benefits.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/ensureWhiteLabelingPlans.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { DB } from "../controllers";
import {
  SUBSCRIPTION_BILLING_INTERVALS,
  SUBSCRIPTION_PLAN_CATEGORIES,
  WHITE_LABELING_FEATURE_KEYS,
  WHITE_LABELING_PLAN_NAME,
  WHITE_LABELING_PRICING,
  WHITE_LABELING_QUARTERLY_BENEFITS,
  WHITE_LABELING_YEARLY_BENEFITS,
  resolveBillingIntervalFromDuration,
} from "../common/constants/subscriptionCategories";
import { listPlanBenefits } from "../services/subscriptionPlan.service";
import { PUBLISHER_STANDARD_LISTING_LIMIT } from "../common/constants/publisherListingLimits";

async function ensureWhiteLabelingFeatures(): Promise<string[]> {
  const ids: string[] = [];
  for (const feature of WHITE_LABELING_FEATURE_KEYS) {
    const existing = await DB.Models.PlanFeature.findOne({ key: feature.key });
    if (existing) {
      if (existing.label !== feature.label) {
        existing.label = feature.label;
        await existing.save();
      }
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

async function getListingsFeatureId(): Promise<string | null> {
  const feature = await DB.Models.PlanFeature.findOne({ key: "LISTINGS" }).lean();
  return feature?._id?.toString() ?? null;
}

async function backfillStandardPlans() {
  const plans = await DB.Models.SubscriptionPlan.find({
    code: { $ne: WHITE_LABELING_PRICING.quarterlyCode },
    category: { $ne: SUBSCRIPTION_PLAN_CATEGORIES.WHITE_LABELING },
  }).populate("features.feature");

  let updated = 0;
  for (const plan of plans) {
    let changed = false;
    if (plan.category !== SUBSCRIPTION_PLAN_CATEGORIES.STANDARD) {
      plan.category = SUBSCRIPTION_PLAN_CATEGORIES.STANDARD;
      changed = true;
    }
    const interval =
      plan.billingInterval ||
      resolveBillingIntervalFromDuration(plan.durationInDays) ||
      undefined;
    if (interval && plan.billingInterval !== interval) {
      plan.billingInterval = interval;
      changed = true;
    }
    if (!plan.benefits?.length) {
      const derived = listPlanBenefits(plan);
      if (derived.length) {
        plan.benefits = derived;
        changed = true;
      }
    }
    if (Array.isArray(plan.discountedPlans)) {
      for (const dp of plan.discountedPlans) {
        const dpInterval =
          dp.billingInterval ||
          resolveBillingIntervalFromDuration(dp.durationInDays) ||
          undefined;
        if (dpInterval && dp.billingInterval !== dpInterval) {
          dp.billingInterval = dpInterval;
          changed = true;
        }
        if (!dp.benefits?.length) {
          const derived = listPlanBenefits({
            benefits: plan.benefits,
            features: plan.features,
          });
          if (derived.length) {
            dp.benefits = derived;
            changed = true;
          }
        }
      }
    }
    if (changed) {
      await plan.save();
      updated += 1;
    }
  }
  console.log(`Backfilled Standard category on ${updated} plan(s).`);
}

async function ensureWhiteLabelingPlan(featureIds: string[], listingsFeatureId: string | null) {
  const existing = await DB.Models.SubscriptionPlan.findOne({
    code: WHITE_LABELING_PRICING.quarterlyCode,
  });

  const features = [
    ...(listingsFeatureId
      ? [
          {
            feature: listingsFeatureId,
            type: "count" as const,
            value: PUBLISHER_STANDARD_LISTING_LIMIT,
          },
        ]
      : []),
    ...featureIds.map((id) => ({
      feature: id,
      type: "boolean" as const,
      value: 1,
    })),
  ];

  const payload = {
    name: `${WHITE_LABELING_PLAN_NAME} — Quarterly`,
    code: WHITE_LABELING_PRICING.quarterlyCode,
    price: WHITE_LABELING_PRICING.quarterly,
    currency: "NGN",
    durationInDays: WHITE_LABELING_PRICING.quarterlyDays,
    isActive: true,
    isTrial: false,
    hiddenFromCatalog: false,
    unlimitedListings: false,
    category: SUBSCRIPTION_PLAN_CATEGORIES.WHITE_LABELING,
    billingInterval: SUBSCRIPTION_BILLING_INTERVALS.QUARTERLY,
    benefits: WHITE_LABELING_QUARTERLY_BENEFITS,
    features,
    discountedPlans: [
      {
        name: `${WHITE_LABELING_PLAN_NAME} — Yearly`,
        code: WHITE_LABELING_PRICING.yearlyCode,
        price: WHITE_LABELING_PRICING.yearly,
        durationInDays: WHITE_LABELING_PRICING.yearlyDays,
        discountPercentage: WHITE_LABELING_PRICING.yearlyDiscountPercentage,
        billingInterval: SUBSCRIPTION_BILLING_INTERVALS.YEARLY,
        benefits: WHITE_LABELING_YEARLY_BENEFITS,
      },
    ],
  };

  if (existing) {
    Object.assign(existing, payload);
    await existing.save();
    console.log(`Updated ${WHITE_LABELING_PLAN_NAME} plan.`);
    return;
  }

  await DB.Models.SubscriptionPlan.create(payload);
  console.log(`Created ${WHITE_LABELING_PLAN_NAME} plan.`);
}

async function run() {
  await mongoose.connect(process.env.MONGO_URL!);
  console.log("Connected to MongoDB");

  const featureIds = await ensureWhiteLabelingFeatures();
  const listingsFeatureId = await getListingsFeatureId();
  if (!listingsFeatureId) {
    console.warn("LISTINGS PlanFeature not found; white-labeling plan will miss listing quota until it is seeded.");
  }
  await backfillStandardPlans();
  await ensureWhiteLabelingPlan(featureIds, listingsFeatureId);

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
