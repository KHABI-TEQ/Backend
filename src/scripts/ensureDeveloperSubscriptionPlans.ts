/**
 * Ensures Developer Property Distribution and Off-Plan plans exist.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/ensureDeveloperSubscriptionPlans.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { DB } from "../controllers";
import {
  DEVELOPER_DISTRIBUTION_BENEFITS,
  DEVELOPER_DISTRIBUTION_PLAN_NAME,
  DEVELOPER_OFFPLAN_ANNUAL_BENEFITS,
  DEVELOPER_OFFPLAN_ANNUAL_PLAN_NAME,
  DEVELOPER_OFFPLAN_BENEFITS,
  DEVELOPER_OFFPLAN_PLAN_NAME,
  DEVELOPER_PLAN_PRICING,
  SUBSCRIPTION_BILLING_INTERVALS,
  SUBSCRIPTION_PLAN_AUDIENCES,
  SUBSCRIPTION_PLAN_CATEGORIES,
} from "../common/constants/subscriptionCategories";

async function upsertPlan(payload: {
  name: string;
  code: string;
  price: number;
  durationInDays: number;
  billingInterval: string;
  benefits: string[];
  maxProfessionals: number;
  allowsOffPlan: boolean;
}) {
  const existing = await DB.Models.SubscriptionPlan.findOne({ code: payload.code });
  const body = {
    name: payload.name,
    price: payload.price,
    currency: "NGN",
    durationInDays: payload.durationInDays,
    billingInterval: payload.billingInterval,
    benefits: payload.benefits,
    maxProfessionals: payload.maxProfessionals,
    allowsOffPlan: payload.allowsOffPlan,
    audience: SUBSCRIPTION_PLAN_AUDIENCES.DEVELOPER,
    category: SUBSCRIPTION_PLAN_CATEGORIES.STANDARD,
    isActive: true,
    isTrial: false,
    hiddenFromCatalog: false,
    unlimitedListings: false,
  };

  if (existing) {
    await DB.Models.SubscriptionPlan.updateOne({ _id: existing._id }, { $set: body });
    console.log(`Updated ${payload.name} (${payload.code}).`);
    return;
  }

  await DB.Models.SubscriptionPlan.create({
    ...body,
    code: payload.code,
    features: [],
  });
  console.log(`Created ${payload.name} (${payload.code}).`);
}

async function run() {
  await mongoose.connect(process.env.MONGO_URL!);
  console.log("Connected to MongoDB");
  void DB.Models.SubscriptionPlan;

  await upsertPlan({
    name: DEVELOPER_DISTRIBUTION_PLAN_NAME,
    code: DEVELOPER_PLAN_PRICING.distributionCode,
    price: DEVELOPER_PLAN_PRICING.distribution,
    durationInDays: DEVELOPER_PLAN_PRICING.distributionDays,
    billingInterval: SUBSCRIPTION_BILLING_INTERVALS.QUARTERLY,
    benefits: DEVELOPER_DISTRIBUTION_BENEFITS,
    maxProfessionals: DEVELOPER_PLAN_PRICING.distributionProfessionals,
    allowsOffPlan: false,
  });

  await upsertPlan({
    name: DEVELOPER_OFFPLAN_PLAN_NAME,
    code: DEVELOPER_PLAN_PRICING.offPlanCode,
    price: DEVELOPER_PLAN_PRICING.offPlan,
    durationInDays: DEVELOPER_PLAN_PRICING.offPlanDays,
    billingInterval: SUBSCRIPTION_BILLING_INTERVALS.QUARTERLY,
    benefits: DEVELOPER_OFFPLAN_BENEFITS,
    maxProfessionals: DEVELOPER_PLAN_PRICING.offPlanProfessionals,
    allowsOffPlan: true,
  });

  await upsertPlan({
    name: DEVELOPER_OFFPLAN_ANNUAL_PLAN_NAME,
    code: DEVELOPER_PLAN_PRICING.offPlanAnnualCode,
    price: DEVELOPER_PLAN_PRICING.offPlanAnnual,
    durationInDays: DEVELOPER_PLAN_PRICING.offPlanAnnualDays,
    billingInterval: SUBSCRIPTION_BILLING_INTERVALS.YEARLY,
    benefits: DEVELOPER_OFFPLAN_ANNUAL_BENEFITS,
    maxProfessionals: DEVELOPER_PLAN_PRICING.offPlanAnnualProfessionals,
    allowsOffPlan: true,
  });

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
