/**
 * Ensures Portfolio Unlimited exists and aligns LISTINGS features:
 * - Free / trial plans → 10
 * - Paid Premium catalog plans → 25
 * - Portfolio Unlimited → unlimited
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/ensurePortfolioUnlimitedPlan.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { DB } from "../controllers";
import {
  FREE_TRIAL_LISTING_LIMIT,
  PORTFOLIO_UNLIMITED_PRICING,
  PUBLISHER_STANDARD_LISTING_LIMIT,
  SPECIAL_UNLIMITED_LISTINGS_PLAN_CODE,
  SPECIAL_UNLIMITED_LISTINGS_PLAN_NAME,
} from "../common/constants/publisherListingLimits";

async function getListingsFeatureId(): Promise<string | null> {
  const feature = await DB.Models.PlanFeature.findOne({ key: "LISTINGS" }).lean();
  return feature?._id?.toString() ?? null;
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

async function ensurePortfolioUnlimitedPlan(listingsFeatureId: string) {
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
    features: [
      {
        feature: listingsFeatureId,
        type: "unlimited" as const,
        value: 0,
      },
    ],
    discountedPlans: [
      {
        name: `${SPECIAL_UNLIMITED_LISTINGS_PLAN_NAME} — Quarterly`,
        code: PORTFOLIO_UNLIMITED_PRICING.quarterlyCode,
        price: PORTFOLIO_UNLIMITED_PRICING.quarterly,
        durationInDays: PORTFOLIO_UNLIMITED_PRICING.quarterlyDays,
        discountPercentage: 11,
      },
      {
        name: `${SPECIAL_UNLIMITED_LISTINGS_PLAN_NAME} — Annual`,
        code: PORTFOLIO_UNLIMITED_PRICING.annualCode,
        price: PORTFOLIO_UNLIMITED_PRICING.annual,
        durationInDays: PORTFOLIO_UNLIMITED_PRICING.annualDays,
        discountPercentage: 22,
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

async function alignCatalogListingCaps(listingsFeatureId: string) {
  const plans = await DB.Models.SubscriptionPlan.find({
    code: { $ne: SPECIAL_UNLIMITED_LISTINGS_PLAN_CODE },
    unlimitedListings: { $ne: true },
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

  await ensurePortfolioUnlimitedPlan(listingsFeatureId);
  await alignCatalogListingCaps(listingsFeatureId);

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
