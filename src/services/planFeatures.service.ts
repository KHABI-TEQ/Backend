import { IPlanFeatureDoc } from "../models";
import { DB } from "../controllers";

export class PlanFeatureService {
  private static FeatureModel = DB.Models.PlanFeature;

  /**
   * Create a new feature
   */
  static async createFeature({
    key,
    label,
    isActive = true
  }: {
    key: string;
    label: string;
    isActive?: boolean;
  }): Promise<IPlanFeatureDoc> {
    const existing = await this.FeatureModel.findOne({ key });
    if (existing) {
      throw new Error(`Feature with key "${key}" already exists`);
    }

    const feature = new this.FeatureModel({ key, label, isActive });
    return feature.save();
  }

  /**
   * Update feature by key
   */
  static async updateFeature(
    key: string,
    updates: Partial<{ label: string; isActive: boolean }>
  ): Promise<IPlanFeatureDoc> {
    const feature = await this.FeatureModel.findOne({ key });
    if (!feature) {
      throw new Error(`Feature with key "${key}" not found`);
    }

    if (updates.label !== undefined) feature.label = updates.label;
    if (updates.isActive !== undefined) feature.isActive = updates.isActive;

    return feature.save();
  }

  /**
   * Get feature by key or _id
   */
  static async getFeature(identifier: string): Promise<IPlanFeatureDoc | null> {
    const filter = /^[0-9a-fA-F]{24}$/.test(identifier)
      ? { _id: identifier } // if valid ObjectId
      : { key: identifier }; // otherwise treat as key

    return this.FeatureModel.findOne(filter).lean();
  }

  /**
   * Get all features
   * @param onlyActive - if true, fetch only active features
   */
  static async getAllFeatures(onlyActive: boolean = false): Promise<IPlanFeatureDoc[]> {
    const query = onlyActive ? { isActive: true } : {};
    return this.FeatureModel.find(query).lean();
  }


  /**
   * Delete feature
   */
  static async deleteFeature(key: string): Promise<boolean> {
    const result = await this.FeatureModel.deleteOne({ key });
    return result.deletedCount > 0;
  }
}
