/**
 * Keeps the Property Scout catalog plan in sync (₦23,500 / 3 months).
 * White-labeling / monthly scout SKUs are retired from public sale.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/ensureScoutSubscriptionPlans.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { DB } from "../controllers";
import {
  SCOUT_STANDARD_PLAN_NAME,
  SCOUT_STANDARD_PRICING,
  SUBSCRIPTION_BILLING_INTERVALS,
  SUBSCRIPTION_PLAN_AUDIENCES,
  SUBSCRIPTION_PLAN_CATEGORIES,
} from "../common/constants/subscriptionCategories";
import { CATALOG_PLANS } from "../common/constants/subscriptionCatalog";
import { SCOUT_PORTFOLIO_UNLIMITED_PRICING } from "../common/constants/publisherListingLimits";

async function run() {
  await mongoose.connect(process.env.MONGO_URL!);
  console.log("Connected to MongoDB");
  void DB.Models.SubscriptionPlan;

  const scout = CATALOG_PLANS.find((p) => p.code === SCOUT_STANDARD_PRICING.quarterlyCode);
  if (!scout) throw new Error("Scout catalog definition missing");

  const existing = await DB.Models.SubscriptionPlan.findOne({
    code: SCOUT_STANDARD_PRICING.quarterlyCode,
  });
  const payload = {
    name: SCOUT_STANDARD_PLAN_NAME,
    price: SCOUT_STANDARD_PRICING.quarterly,
    currency: "NGN",
    durationInDays: SCOUT_STANDARD_PRICING.quarterlyDays,
    billingInterval: SUBSCRIPTION_BILLING_INTERVALS.QUARTERLY,
    benefits: scout.benefits,
    audience: SUBSCRIPTION_PLAN_AUDIENCES.SCOUT,
    category: SUBSCRIPTION_PLAN_CATEGORIES.STANDARD,
    isActive: true,
    isTrial: false,
    hiddenFromCatalog: false,
    unlimitedListings: false,
    discountedPlans: [] as Array<{
      name: string;
      code: string;
      price: number;
      durationInDays: number;
    }>,
  };

  if (existing) {
    await DB.Models.SubscriptionPlan.updateOne({ _id: existing._id }, { $set: payload });
    console.log(`Updated ${SCOUT_STANDARD_PLAN_NAME}.`);
  } else {
    await DB.Models.SubscriptionPlan.create({
      ...payload,
      code: SCOUT_STANDARD_PRICING.quarterlyCode,
      features: [],
    });
    console.log(`Created ${SCOUT_STANDARD_PLAN_NAME}.`);
  }

  await DB.Models.SubscriptionPlan.updateMany(
    {
      audience: SUBSCRIPTION_PLAN_AUDIENCES.SCOUT,
      code: {
        $nin: [
          SCOUT_STANDARD_PRICING.quarterlyCode,
          SCOUT_PORTFOLIO_UNLIMITED_PRICING.monthlyCode,
        ],
      },
    },
    { $set: { hiddenFromCatalog: true, isActive: false } }
  );

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
