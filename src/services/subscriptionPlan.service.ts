import { Types } from "mongoose";
import { DB } from "../controllers";
import { ISubscriptionPlanDoc } from "../models";

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
    discountedPlans?: {
      name: string;
      code: string;
      price: number;
      durationInDays: number;
      discountPercentage?: number;
    }[];
  }): Promise<ISubscriptionPlanDoc> {
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
      discountedPlans: discountedPlans.map(dp => ({
        ...dp,
        code: dp.code.toUpperCase().trim()
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
      discountedPlans: {
        name: string;
        code: string;
        price: number;
        durationInDays: number;
        discountPercentage?: number;
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
      }));
    }

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
  static async getAllActivePlans(): Promise<ISubscriptionPlanDoc[]> {
    return this.PlanModel.find({ isActive: true })
      .populate("features.feature")
      .lean();
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
