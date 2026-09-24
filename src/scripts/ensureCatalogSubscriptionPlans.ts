/**
 * Syncs the public subscription catalog to the screenshot plans only.
 *
 * Run: npm run ensure-catalog-subscription-plans
 */
import "dotenv/config";
import mongoose from "mongoose";
import { DB } from "../controllers";
import {
  ALL_CATALOG_PLAN_CODES,
  CATALOG_PLAN_CODES,
  CATALOG_PLANS,
  CATALOG_VISIBLE_PLAN_CODES,
} from "../common/constants/subscriptionCatalog";
import {
  SUBSCRIPTION_PLAN_CATEGORIES,
  isWhiteLabelingPlanCode,
} from "../common/constants/subscriptionCategories";
import { RETIRED_UNLIMITED_LISTINGS_PLAN_CODES } from "../common/constants/publisherListingLimits";

const KEEP_ACTIVE_HIDDEN_CODES = new Set<string>();

async function releaseDiscountedCodes(codes: string[]) {
  const plans = await DB.Models.SubscriptionPlan.find({
    "discountedPlans.code": { $in: codes },
  });
  for (const plan of plans) {
    const before = plan.discountedPlans?.length || 0;
    plan.discountedPlans = (plan.discountedPlans || []).filter(
      (dp) => !codes.includes(String(dp.code || "").toUpperCase())
    );
    if ((plan.discountedPlans?.length || 0) !== before) {
      await plan.save();
      console.log(`Released discounted catalog codes from ${plan.code}.`);
    }
  }
}

async function upsertCatalogPlan(definition: (typeof CATALOG_PLANS)[number]) {
  const existing = await DB.Models.SubscriptionPlan.findOne({
    code: definition.code,
  });
  const body = {
    name: definition.name,
    price: definition.price,
    currency: "NGN",
    durationInDays: definition.durationInDays,
    billingInterval: definition.billingInterval,
    benefits: definition.benefits,
    audience: definition.audience,
    category: SUBSCRIPTION_PLAN_CATEGORIES.STANDARD,
    isActive: true,
    isTrial: false,
    hiddenFromCatalog: false,
    unlimitedListings: false,
    listingLimit: definition.listingLimit || 0,
    maxProfessionals: definition.maxProfessionals || 0,
    allowsOffPlan: !!definition.allowsOffPlan,
    discountedPlans: (definition.discountedPlans || []).map((dp) => ({
      name: dp.name,
      code: dp.code,
      price: dp.price,
      durationInDays: dp.durationInDays,
      billingInterval: dp.billingInterval,
      benefits: definition.benefits,
      listingLimit: dp.listingLimit || definition.listingLimit || 0,
    })),
  };

  if (existing) {
    await DB.Models.SubscriptionPlan.updateOne({ _id: existing._id }, { $set: body });
    console.log(`Updated ${definition.name} (${definition.code}).`);
    return;
  }

  await DB.Models.SubscriptionPlan.create({
    ...body,
    code: definition.code,
    features: [],
  });
  console.log(`Created ${definition.name} (${definition.code}).`);
}

async function retireNonCatalogPlans() {
  const plans = await DB.Models.SubscriptionPlan.find({
    code: { $nin: CATALOG_VISIBLE_PLAN_CODES },
  });

  let hidden = 0;
  for (const plan of plans) {
    const code = String(plan.code || "").toUpperCase();
    const keepHiddenActive = KEEP_ACTIVE_HIDDEN_CODES.has(code) || !!plan.isTrial;
    const isWhiteLabel =
      plan.category === SUBSCRIPTION_PLAN_CATEGORIES.WHITE_LABELING ||
      isWhiteLabelingPlanCode(code);

    plan.hiddenFromCatalog = true;
    if (isWhiteLabel || !keepHiddenActive) {
      plan.isActive = keepHiddenActive && !isWhiteLabel;
    }
    if (isWhiteLabel) {
      plan.isActive = false;
    }
    await plan.save();
    hidden += 1;
  }
  console.log(`Hid ${hidden} non-catalog plan(s) from public sale.`);
}

async function run() {
  await mongoose.connect(process.env.MONGO_URL!);
  console.log("Connected to MongoDB");
  void DB.Models.SubscriptionPlan;

  await releaseDiscountedCodes(ALL_CATALOG_PLAN_CODES);

  for (const plan of CATALOG_PLANS) {
    if (plan.code === CATALOG_PLAN_CODES.DEV_OFFPLAN_YEARLY) {
      await upsertCatalogPlan(plan);
      continue;
    }
    await upsertCatalogPlan(plan);
  }

  await retireNonCatalogPlans();

  const retired = await DB.Models.SubscriptionPlan.updateMany(
    { code: { $in: [...RETIRED_UNLIMITED_LISTINGS_PLAN_CODES] } },
    { $set: { isActive: false, hiddenFromCatalog: true, unlimitedListings: false } }
  );
  console.log(`Retired ${retired.modifiedCount} Portfolio Unlimited plan(s).`);

  await mongoose.disconnect();
  console.log("Catalog subscription plans synced.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
