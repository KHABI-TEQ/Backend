import { ISystemSettingDoc } from "../models";
import { DB } from "../controllers";

export class SystemSettingService {
  private static SettingModel = DB.Models.SystemSetting;

  /**
   * Create a new setting
   */
  static async createSetting({
    key,
    value,
    description,
    category,
    isEditable = true,
    status
  }: {
    key: string;
    value: any;
    description?: string;
    category?: string;
    isEditable?: boolean;
    status?: "active" | "inactive"
  }): Promise<ISystemSettingDoc> {

    const existing = await this.SettingModel.findOne({ key });

    if (existing) {
      throw new Error(`Setting with key "${key}" already exists`);
    }

    const setting = new this.SettingModel({
      key,
      value,
      description,
      category,
      isEditable,
      status
    });

    return setting.save();
  }

    /**
 * Update an existing setting by key, or create new if not found
 */
  static async updateSetting(
    key: string,
    value: any,
    description?: string,
    category?: string,
    status?: "active" | "inactive"
  ): Promise<ISystemSettingDoc> {
    // validate status
    if (status && !["active", "inactive"].includes(status)) {
        throw new Error(`Invalid status "${status}". Allowed values are "active" or "inactive".`);
    }

    let setting = await this.SettingModel.findOne({ key });

    if (!setting) {
        // Create new setting if not found
        setting = new this.SettingModel({
        key,
        value,
        description,
        category,
        isEditable: true,
        status: status || "active", // default to active
        });
    } else {
        // If found, check editability
        if (!setting.isEditable) {
        throw new Error(`Setting with key "${key}" is not editable`);
        }

        if (value !== undefined) setting.value = value;
        if (description !== undefined) setting.description = description;
        if (category !== undefined) setting.category = category;

        // ensure only active/inactive
        if (status) {
            setting.status = status;
        }
    }

    return setting.save();
  }

 

  /**
   * Get a single setting by key
   */
  static async getSetting(key: string): Promise<ISystemSettingDoc | null> {
    return this.SettingModel.findOne({ key }).lean();
  }

  /**
   * Get all settings (optionally by category)
   */
  static async getAllSettings(category?: string): Promise<ISystemSettingDoc[]> {
    const query = category ? { category } : {};
    return this.SettingModel.find(query).lean();
  }

  /**
   * Delete a setting (optional if you want it)
   */
  static async deleteSetting(key: string): Promise<boolean> {
    const result = await this.SettingModel.deleteOne({ key });
    return result.deletedCount > 0;
  }
}
