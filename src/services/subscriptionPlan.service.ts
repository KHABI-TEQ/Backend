import { Types } from "mongoose";
import { DB } from "../controllers";
import { ISubscriptionPlanDoc } from "../models";
import {
  SUBSCRIPTION_PLAN_CATEGORIES,
  SUBSCRIPTION_PLAN_AUDIENCES,
  assertWhiteLabelingBillingInterval,
  audienceLabel,
  categoryLabel,
  isRetiredStandardBenefit,
  isRetiredStandardFeatureKey,
  isWhiteLabelingCategory,
  resolveBillingIntervalFromDuration,
  resolvePlanAudience,
  resolvePlanCategory,
  withoutRetiredStandardBenefits,
  SUBSCRIPTION_BILLING_INTERVAL_LABELS,
  type SubscriptionBillingInterval,
  type SubscriptionPlanAudience,
  type SubscriptionPlanCategory,
} from "../common/constants/subscriptionCategories";

export type ResolvedSubscriptionPlan = {
  plan: ISubscriptionPlanDoc;
  planType: "standard" | "discounted";
  planCode: string;
  appliedPlanName: string;
  price: number;
  durationInDays: number;
  billingInterval: SubscriptionBillingInterval | null;
  category: SubscriptionPlanCategory;
  benefits: string[];
};

function normalizeBenefits(benefits?: string[]): string[] {
  if (!Array.isArray(benefits)) return [];
  return benefits.map((b) => String(b || "").trim()).filter(Boolean);
}

function formatAssignedFeatureBenefit(assigned: any): string | null {
  const featureDoc = assigned?.feature;
  const key =
    typeof featureDoc === "object" ? String(featureDoc?.key || "") : "";
  if (isRetiredStandardFeatureKey(key)) return null;
  const label =
    (typeof featureDoc === "object" && (featureDoc?.label || featureDoc?.key)) ||
    null;
  if (!label) return null;
  if (isRetiredStandardBenefit(String(label))) return null;
  if (assigned.type === "unlimited") return `Unlimited ${label}`;
  if (assigned.type === "count") {
    const n = Number(assigned.value);
    return Number.isFinite(n) && n > 0 ? `${n} ${label}` : label;
  }
  if (assigned.type === "boolean" && Number(assigned.value) === 0) return null;
  return String(label);
}

export function listPlanBenefits(plan: {
  benefits?: string[];
  features?: any[];
}): string[] {
  const stored = withoutRetiredStandardBenefits(normalizeBenefits(plan.benefits));
  if (stored.length) return stored;
  return (plan.features || [])
    .map(formatAssignedFeatureBenefit)
    .filter((b): b is string => Boolean(b));
}

function resolveInterval(
  billingInterval?: string,
  durationInDays?: number
): SubscriptionBillingInterval | null {
  if (billingInterval && SUBSCRIPTION_BILLING_INTERVAL_LABELS[billingInterval as SubscriptionBillingInterval]) {
    return billingInterval as SubscriptionBillingInterval;
  }
  return resolveBillingIntervalFromDuration(durationInDays);
}

export class SubscriptionPlanService {
  private static PlanModel = DB.Models.SubscriptionPlan;
  private static FeatureModel = DB.Models.PlanFeature;

  /**
   * Create a subscription plan
   */
  static async createPlan({
    name,
    code,
    price,
    durationInDays,
    currency = "NGN",
    features = [],
    isActive = true,
    isTrial = false,
    hiddenFromCatalog = false,
    unlimitedListings = false,
    category = SUBSCRIPTION_PLAN_CATEGORIES.STANDARD,
    audience = SUBSCRIPTION_PLAN_AUDIENCES.LICENSED,
    billingInterval,
    benefits = [],
    discountedPlans = []
  }: {
    name: string;
    code: string;
    price: number;
    durationInDays: number;
    currency?: string;
    features?: {
      featureId: string;
      type: "boolean" | "count" | "unlimited";
      value?: number;
    }[];
    isActive?: boolean;
    isTrial?: boolean;
    hiddenFromCatalog?: boolean;
    unlimitedListings?: boolean;
    category?: SubscriptionPlanCategory;
    audience?: SubscriptionPlanAudience;
    billingInterval?: SubscriptionBillingInterval;
    benefits?: string[];
    discountedPlans?: {
      name: string;
      code: string;
      price: number;
      durationInDays: number;
      discountPercentage?: number;
      billingInterval?: SubscriptionBillingInterval;
      benefits?: string[];
    }[];
  }): Promise<ISubscriptionPlanDoc> {
    const resolvedCategory = resolvePlanCategory(category);
    const resolvedInterval =
      billingInterval || resolveBillingIntervalFromDuration(durationInDays) || undefined;

    this.assertCategoryIntervals({
      category: resolvedCategory,
      billingInterval: resolvedInterval,
      durationInDays,
      discountedPlans,
    });

    // ✅ Ensure main code is unique
    const existing = await this.PlanModel.findOne({ code });
    if (existing) throw new Error(`Plan with code "${code}" already exists`);

    // ✅ Ensure discounted codes are unique within this payload
    const codes = discountedPlans.map(dp => dp.code.toUpperCase().trim());
    const duplicate = codes.find(
      (c, idx) => codes.indexOf(c) !== idx
    );
    if (duplicate) {
      throw new Error(`Duplicate discounted plan code "${duplicate}" in payload`);
    }

    // ✅ Ensure discounted codes are globally unique across all plans
    for (const dp of discountedPlans) {
      const exists = await this.PlanModel.findOne({
        "discountedPlans.code": dp.code.toUpperCase().trim()
      });
      if (exists) {
        throw new Error(`Discounted plan code "${dp.code}" already exists in another plan`);
      }
    }

    const assignedFeatures = await this.validateAndFormatFeatures(features);

    const plan = new this.PlanModel({
      name,
      code,
      price,
      durationInDays,
      currency,
      features: assignedFeatures,
      isActive,
      isTrial,
      hiddenFromCatalog,
      unlimitedListings,
      category: resolvedCategory,
      audience: resolvePlanAudience(audience),
      billingInterval: resolvedInterval,
      benefits: normalizeBenefits(benefits),
      discountedPlans: discountedPlans.map(dp => ({
        ...dp,
        code: dp.code.toUpperCase().trim(),
        benefits: normalizeBenefits(dp.benefits),
        billingInterval:
          dp.billingInterval ||
          resolveBillingIntervalFromDuration(dp.durationInDays) ||
          undefined,
      }))
    });

    return plan.save();
  }


  /**
   * Update a subscription plan
   */
  static async updatePlan(
    planId: string,
    updates: Partial<{
      name: string;
      price: number;
      durationInDays: number;
      currency: string;
      features: {
        featureId: string;
        type: "boolean" | "count" | "unlimited";
        value?: number;
      }[];
      isActive: boolean;
      isTrial: boolean;
      hiddenFromCatalog: boolean;
      unlimitedListings: boolean;
      category: SubscriptionPlanCategory;
      audience: SubscriptionPlanAudience;
      billingInterval: SubscriptionBillingInterval;
      benefits: string[];
      discountedPlans: {
        name: string;
        code: string;
        price: number;
        durationInDays: number;
        discountPercentage?: number;
        billingInterval?: SubscriptionBillingInterval;
        benefits?: string[];
      }[];
    }>
  ): Promise<ISubscriptionPlanDoc> {

    const plan = await this.PlanModel.findOne({ _id: planId });

    if (!plan) throw new Error(`Plan with code "${planId}" not found`);

    if (updates.features) {
      plan.features = await this.validateAndFormatFeatures(updates.features);
    }

    if (updates.name !== undefined) plan.name = updates.name;
    if (updates.price !== undefined) plan.price = updates.price;
    if (updates.durationInDays !== undefined) plan.durationInDays = updates.durationInDays;
    if (updates.currency !== undefined) plan.currency = updates.currency;
    if (updates.isActive !== undefined) plan.isActive = updates.isActive;
    if (updates.isTrial !== undefined) plan.isTrial = updates.isTrial;
    if (updates.hiddenFromCatalog !== undefined) plan.hiddenFromCatalog = updates.hiddenFromCatalog;
    if (updates.unlimitedListings !== undefined) plan.unlimitedListings = updates.unlimitedListings;
    if (updates.category !== undefined) plan.category = resolvePlanCategory(updates.category);
    if (updates.audience !== undefined) plan.audience = resolvePlanAudience(updates.audience);
    if (updates.billingInterval !== undefined) plan.billingInterval = updates.billingInterval;
    if (updates.benefits !== undefined) plan.benefits = normalizeBenefits(updates.benefits);

    if (updates.discountedPlans !== undefined) {
      const codes = updates.discountedPlans.map(dp => dp.code.toUpperCase().trim());

      // ✅ Ensure no duplicate codes in the update payload
      const duplicate = codes.find((c, idx) => codes.indexOf(c) !== idx);
      if (duplicate) {
        throw new Error(`Duplicate discounted plan code "${duplicate}" in payload`);
      }

      // ✅ Ensure codes are globally unique (excluding the current plan)
      for (const dp of updates.discountedPlans) {
        const exists = await this.PlanModel.findOne({
          code: { $ne: plan.code }, // exclude current plan
          "discountedPlans.code": dp.code.toUpperCase().trim(),
        });
        if (exists) {
          throw new Error(`Discounted plan code "${dp.code}" already exists in another plan`);
        }
      }

      plan.discountedPlans = updates.discountedPlans.map(dp => ({
        ...dp,
        code: dp.code.toUpperCase().trim(),
        benefits: normalizeBenefits(dp.benefits),
        billingInterval:
          dp.billingInterval ||
          resolveBillingIntervalFromDuration(dp.durationInDays) ||
          undefined,
      }));
    }

    this.assertCategoryIntervals({
      category: resolvePlanCategory(plan.category),
      billingInterval: plan.billingInterval,
      durationInDays: plan.durationInDays,
      discountedPlans: plan.discountedPlans,
    });

    return plan.save();
  }


  /**
   * Get a plan by code or _id
   */
  static async getPlan(identifier: string): Promise<ISubscriptionPlanDoc | null> {
    const filter = /^[0-9a-fA-F]{24}$/.test(identifier)
      ? { _id: identifier } // if identifier looks like ObjectId
      : { code: identifier }; // otherwise treat as code

    return this.PlanModel.findOne(filter)
      .populate("features.feature")
      .lean();
  }


  /**
   * Get all plans
   */
  static async getAllPlans(): Promise<ISubscriptionPlanDoc[]> {
    return this.PlanModel.find().populate("features.feature").lean();
  }

  /**
   * Get all active plans
   */
  static async getAllActivePlans(options?: {
    includeHiddenFromCatalog?: boolean;
    category?: SubscriptionPlanCategory | "all";
    audience?: SubscriptionPlanAudience | "all";
  }): Promise<ISubscriptionPlanDoc[]> {
    const filter: Record<string, unknown> = { isActive: true };
    const and: Record<string, unknown>[] = [];
    const category = options?.category ?? SUBSCRIPTION_PLAN_CATEGORIES.STANDARD;

    if (category !== "all") {
      if (category === SUBSCRIPTION_PLAN_CATEGORIES.STANDARD) {
        and.push({
          $or: [
            { category: SUBSCRIPTION_PLAN_CATEGORIES.STANDARD },
            { category: { $exists: false } },
            { category: null },
          ],
        });
      } else {
        and.push({ category });
      }
    }

    const audience = options?.audience ?? SUBSCRIPTION_PLAN_AUDIENCES.LICENSED;
    if (audience !== "all") {
      if (audience === SUBSCRIPTION_PLAN_AUDIENCES.SCOUT) {
        and.push({ audience: SUBSCRIPTION_PLAN_AUDIENCES.SCOUT });
      } else if (audience === SUBSCRIPTION_PLAN_AUDIENCES.DEVELOPER) {
        and.push({ audience: SUBSCRIPTION_PLAN_AUDIENCES.DEVELOPER });
      } else {
        and.push({
          $or: [
            { audience: SUBSCRIPTION_PLAN_AUDIENCES.LICENSED },
            { audience: { $exists: false } },
            { audience: null },
          ],
        });
      }
    }

    if (and.length) filter.$and = and;

    if (
      !options?.includeHiddenFromCatalog &&
      category !== SUBSCRIPTION_PLAN_CATEGORIES.WHITE_LABELING
    ) {
      filter.hiddenFromCatalog = { $ne: true };
      filter.unlimitedListings = { $ne: true };
    }
    return this.PlanModel.find(filter)
      .populate("features.feature")
      .lean();
  }

  /**
   * Resolve a live plan (or discounted variant) by code.
   */
  static async resolveActivePlanByCode(
    planCode: string
  ): Promise<ResolvedSubscriptionPlan> {
    const code = String(planCode || "").trim().toUpperCase();
    if (!code) {
      throw new Error("Plan code is required");
    }

    let plan = await this.PlanModel.findOne({
      code,
      isActive: true,
    }).populate("features.feature");

    let planType: "standard" | "discounted" = "standard";
    let appliedPlanName: string;
    let price: number;
    let durationInDays: number;
    let billingInterval: SubscriptionBillingInterval | null;
    let benefits: string[];

    if (plan) {
      appliedPlanName = plan.name;
      price = plan.price;
      durationInDays = plan.durationInDays;
      billingInterval = resolveInterval(plan.billingInterval, durationInDays);
      benefits = listPlanBenefits(plan);
    } else {
      plan = await this.PlanModel.findOne({
        "discountedPlans.code": code,
        isActive: true,
      }).populate("features.feature");

      if (!plan) {
        throw new Error("Subscription plan not found");
      }

      const discounted = plan.discountedPlans?.find((dp) => dp.code === code);
      if (!discounted) {
        throw new Error("Discounted plan not found in this subscription");
      }

      planType = "discounted";
      appliedPlanName = discounted.name;
      price = discounted.price;
      durationInDays = discounted.durationInDays;
      billingInterval = resolveInterval(
        discounted.billingInterval,
        durationInDays
      );
      benefits = listPlanBenefits({
        benefits: discounted.benefits,
        features: plan.features,
      });
    }

    const category = resolvePlanCategory(plan.category);
    if (isWhiteLabelingCategory(category)) {
      assertWhiteLabelingBillingInterval({
        billingInterval: billingInterval || undefined,
        durationInDays,
        label: appliedPlanName,
      });
    }

    return {
      plan,
      planType,
      planCode: code,
      appliedPlanName,
      price,
      durationInDays,
      billingInterval,
      category,
      benefits,
    };
  }

  static enrichPlanForCatalog(plan: any) {
    const category = resolvePlanCategory(plan.category);
    const audience = resolvePlanAudience(plan.audience);
    const grantsListingEligibility = true;
    const grantsCustomDomain =
      isWhiteLabelingCategory(category) || !!plan.unlimitedListings;
    const billingInterval = resolveInterval(
      plan.billingInterval,
      plan.durationInDays
    );
    const discountedPlans = (plan.discountedPlans || []).map((dp: any) => {
      const interval = resolveInterval(dp.billingInterval, dp.durationInDays);
      return {
        ...dp,
        category,
        categoryLabel: categoryLabel(category),
        audience,
        audienceLabel: audienceLabel(audience),
        billingInterval: interval,
        billingIntervalLabel: interval
          ? SUBSCRIPTION_BILLING_INTERVAL_LABELS[interval]
          : null,
        grantsListingEligibility,
        grantsCustomDomain,
        benefits: listPlanBenefits({
          benefits: dp.benefits,
          features: plan.features,
        }),
      };
    });

    return {
      ...plan,
      category,
      categoryLabel: categoryLabel(category),
      audience,
      audienceLabel: audienceLabel(audience),
      billingInterval,
      billingIntervalLabel: billingInterval
        ? SUBSCRIPTION_BILLING_INTERVAL_LABELS[billingInterval]
        : null,
      grantsListingEligibility,
      grantsCustomDomain,
      benefits: listPlanBenefits(plan),
      discountedPlans,
    };
  }

  private static assertCategoryIntervals(input: {
    category: SubscriptionPlanCategory;
    billingInterval?: SubscriptionBillingInterval;
    durationInDays: number;
    discountedPlans?: Array<{
      name?: string;
      billingInterval?: SubscriptionBillingInterval;
      durationInDays?: number;
    }>;
  }) {
    if (!isWhiteLabelingCategory(input.category)) return;

    assertWhiteLabelingBillingInterval({
      billingInterval: input.billingInterval,
      durationInDays: input.durationInDays,
    });

    for (const dp of input.discountedPlans || []) {
      assertWhiteLabelingBillingInterval({
        billingInterval: dp.billingInterval,
        durationInDays: dp.durationInDays,
        label: dp.name,
      });
    }
  }

  /**
   * Delete a plan by code
   */
  static async deletePlan(identifier: string): Promise<boolean> {
    const filter =
      /^[0-9a-fA-F]{24}$/.test(identifier)
        ? { _id: identifier } // if identifier looks like ObjectId
        : { code: identifier }; // otherwise treat as code

    const result = await this.PlanModel.deleteOne(filter);
    return result.deletedCount > 0;
  }


  /**
   * Internal helper to validate features
   */
  private static async validateAndFormatFeatures(
    features: {
      featureId: string;
      type: "boolean" | "count" | "unlimited";
      value?: number;
    }[]
  ) {
    if (!features || features.length === 0) return [];

    // prevent duplicates
    const uniqueIds = new Set(features.map(f => f.featureId));
    if (uniqueIds.size !== features.length) {
      throw new Error("Duplicate features are not allowed in a subscription plan");
    }

    const featureIds = features.map(f => new Types.ObjectId(f.featureId));
    const existingFeatures = await this.FeatureModel.find({ _id: { $in: featureIds } });

    if (existingFeatures.length !== featureIds.length) {
      throw new Error("One or more features do not exist in PlanFeature");
    }

    return features.map(f => ({
      feature: new Types.ObjectId(f.featureId),
      type: f.type,
      value: f.value
    }));
  }


  /**
   * Get the active free trial plan (price = 0 and isTrial = true)
   */
  static async getActiveTrialPlan(): Promise<ISubscriptionPlanDoc | null> {
    return this.PlanModel.findOne({
      isActive: true,
      price: 0,
      isTrial: true,
    })
      .populate("features.feature")
      .lean();
  }

}
