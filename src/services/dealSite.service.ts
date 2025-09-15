import { DB } from "../controllers";
import HttpStatusCodes from "../common/HttpStatusCodes";
import { RouteError } from "../common/classes";
import { IDealSite, IDealSiteDoc } from "../models";

export class DealSiteService {

  /**
   * Ensure the user has an active subscription
   */
  private static async ensureActiveSubscription(userId: string) {
    const activeSubscription = await DB.Models.UserSubscriptionSnapshot.findOne({
      user: userId,
      status: "active",
      expiresAt: { $gt: new Date() },
    });

    if (!activeSubscription) {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        "You don't have any valid active subscription. Please purchase a subscription plan to continue."
      );
    }
  }
  /**
   * Sets up a DealSite for an agent
   * - Ensures uniqueness of publicSlug
   * - Ensures an agent cannot create multiple DealSites
   * - Persists the DealSite with defaults and relations
   */
  static async setUpPublicAccess(
    userId: string,
    payload: Partial<IDealSite>
  ): Promise<IDealSiteDoc> {

    await this.ensureActiveSubscription(userId);

    // Ensure publicSlug is unique
    const existingSlug = await DB.Models.DealSite.findOne({
      publicSlug: payload.publicSlug,
    });

    if (existingSlug) {
      throw new RouteError(
        HttpStatusCodes.CONFLICT,
        "Public slug is already taken. Please choose another."
      );
    }

    // Ensure the agent doesn’t already have a DealSite
    const existingUserSite = await DB.Models.DealSite.findOne({
      createdBy: userId,
    });

    if (existingUserSite) {
      throw new RouteError(
        HttpStatusCodes.CONFLICT,
        "You already have a DealSite created."
      );
    }

    // Construct DealSite record
    const dealSite = await DB.Models.DealSite.create({
      ...payload,
      createdBy: userId,
      status: "pending", // default status on creation
    });

    return dealSite;
  }

  /**
   * Fetch a single DealSite by slug
   */
  static async getBySlug(slug: string): Promise<IDealSiteDoc | null> {
    return DB.Models.DealSite.findOne({ publicSlug: slug }).lean();
  }

  /**
   * Fetch DealSites for a specific agent
   */
  static async getByAgent(userId: string): Promise<IDealSiteDoc[]> {
    return DB.Models.DealSite.find({ createdBy: userId }).sort({
      createdAt: -1,
    });
  }

  /**
   * Enable a DealSite (set status to "running")
   */
  static async enableDealSite(
    userId: string,
    publicSlug: string
  ): Promise<IDealSiteDoc> {

    await this.ensureActiveSubscription(userId);

    const dealSite = await DB.Models.DealSite.findOne({
      publicSlug,
      createdBy: userId,
    });

    if (!dealSite) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "DealSite not found");
    }

    dealSite.status = "running";
    await dealSite.save();

    return dealSite;
  }

  /**
   * Disable a DealSite (set status to "on-hold")
   */
  static async disableDealSite(
    userId: string,
    publicSlug: string
  ): Promise<IDealSiteDoc> {

    await this.ensureActiveSubscription(userId);

    const dealSite = await DB.Models.DealSite.findOne({
      publicSlug,
      createdBy: userId,
    });

    if (!dealSite) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "DealSite not found");
    }

    dealSite.status = "paused";
    await dealSite.save();

    return dealSite;
  }

  /**
   * Update DealSite details (slug cannot be changed)
   */
  static async updateDealSiteDetails(
    userId: string,
    publicSlug: string,
    updates: Partial<IDealSite>
  ): Promise<IDealSiteDoc> {

    await this.ensureActiveSubscription(userId);

    const dealSite = await DB.Models.DealSite.findOne({
      publicSlug,
      createdBy: userId,
    });

    if (!dealSite) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "DealSite not found");
    }

    // Prevent slug update
    if (updates.publicSlug && updates.publicSlug !== dealSite.publicSlug) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Public slug cannot be changed once created."
      );
    }

    Object.assign(dealSite, updates);
    await dealSite.save();

    return dealSite;
  }

  /**
   * Delete a DealSite permanently
   */
  static async deleteDealSite(
    userId: string,
    publicSlug: string
  ): Promise<{ success: boolean; message: string }> {

    await this.ensureActiveSubscription(userId);
    
    const dealSite = await DB.Models.DealSite.findOne({
      publicSlug,
      createdBy: userId,
    });

    if (!dealSite) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "DealSite not found");
    }

    await DB.Models.DealSite.deleteOne({ _id: dealSite._id });

    return {
      success: true,
      message: "DealSite deleted successfully",
    };
  }
}
