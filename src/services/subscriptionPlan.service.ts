import { Types } from "mongoose";
import { DB } from "../controllers";
import { ISubscriptionPlanDoc } from "src/models";

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
      price: number;
      durationInDays: number;
      discountPercentage?: number;
    }[];
  }): Promise<ISubscriptionPlanDoc> {
    const existing = await this.PlanModel.findOne({ code });
    if (existing) throw new Error(`Plan with code "${code}" already exists`);

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
      discountedPlans
    });

    return plan.save();
  }

  /**
   * Update a subscription plan
   */
  static async updatePlan(
    code: string,
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
        price: number;
        durationInDays: number;
        discountPercentage?: number;
      }[];
    }>
  ): Promise<ISubscriptionPlanDoc> {
    const plan = await this.PlanModel.findOne({ code });
    if (!plan) throw new Error(`Plan with code "${code}" not found`);

    if (updates.features) {
      plan.features = await this.validateAndFormatFeatures(updates.features);
    }
    if (updates.name !== undefined) plan.name = updates.name;
    if (updates.price !== undefined) plan.price = updates.price;
    if (updates.durationInDays !== undefined) plan.durationInDays = updates.durationInDays;
    if (updates.currency !== undefined) plan.currency = updates.currency;
    if (updates.isActive !== undefined) plan.isActive = updates.isActive;
    if (updates.isTrial !== undefined) plan.isTrial = updates.isTrial;
    if (updates.discountedPlans !== undefined) plan.discountedPlans = updates.discountedPlans;

    return plan.save();
  }

  /**
   * Get a plan by code
   */
  static async getPlan(code: string): Promise<ISubscriptionPlanDoc | null> {
    return this.PlanModel.findOne({ code }).populate("features.feature").lean();
  }

  /**
   * Get all plans
   */
  static async getAllPlans(): Promise<ISubscriptionPlanDoc[]> {
    return this.PlanModel.find().populate("features.feature").lean();
  }

  /**
   * Delete a plan by code
   */
  static async deletePlan(code: string): Promise<boolean> {
    const result = await this.PlanModel.deleteOne({ code });
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
}
