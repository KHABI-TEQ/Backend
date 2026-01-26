import { DB } from "../controllers";
import HttpStatusCodes from "../common/HttpStatusCodes";
import { RouteError } from "../common/classes";
import { IDealSite, IDealSiteDoc } from "../models";
import { Types } from "mongoose";
import { PaystackService } from "./paystack.service";

const confidentialFields = "-paymentDetails -createdBy -__v";

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
        "You already have a Public access page created."
      );
    }

    if (!payload.paymentDetails) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Bank details are required to set up a Public access page"
      );
    }

    const {
      businessName,
      sortCode,
      accountNumber,
      primaryContactEmail,
      primaryContactName,
      primaryContactPhone,
    } = payload.paymentDetails;

    // Call Paystack Subaccount API
    const subAccountResponse = await PaystackService.createSubaccount({
      businessName: businessName,
      settlementBank: sortCode,
      accountNumber: accountNumber,
      percentageCharge: 15, // or fetch from config if needed
      primaryContactEmail: primaryContactEmail,
      primaryContactName: primaryContactName,
      primaryContactPhone: primaryContactPhone,
    });

    // Replace bankDetails with Paystack response
    payload.paymentDetails = {
      subAccountCode: subAccountResponse.subAccountCode,
      accountNumber: subAccountResponse.accountNumber,
      accountName: subAccountResponse.accountName,
      accountBankName: subAccountResponse.accountBankName,
      sortCode: sortCode,
      percentageCharge: subAccountResponse.percentageCharge,
      isVerified: subAccountResponse.isVerified,
      active: subAccountResponse.active,
      primaryContactEmail: primaryContactEmail || null,
      primaryContactName: primaryContactName || null,
      primaryContactPhone: primaryContactPhone || null,
    };

    // Save the DealSite with status "paused" (newly created pages start paused)
    const dealSite = await DB.Models.DealSite.create({
      ...payload,
      createdBy: userId,
      status: "paused",
    });

    return dealSite;
  }


  /**
   * Fetch a single DealSite by slug
   */
  static async getBySlug(
    slug: string,
    excludeConfidential: boolean = false
  ): Promise<IDealSiteDoc | null> {
    const query = DB.Models.DealSite.findOne({ publicSlug: slug });

    if (excludeConfidential) {
      query.select("-paymentDetails -__v");
    }

    return query.lean();
  }


  /**
   * Fetch DealSites for a specific agent
   */
  static async getByAgent(
    userId: string,
    excludeConfidential: boolean = false
  ): Promise<IDealSiteDoc[]> {
    const query = DB.Models.DealSite.find({ createdBy: userId }).sort({
      createdAt: -1,
    });

    if (excludeConfidential) {
      query.select("-paymentDetails -__v");
    }

    return query.lean();
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
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Public access page not found");
    }

    // 🔹 Disallow enabling if on-hold
    if (dealSite.status === "on-hold") {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "You cannot enable this public access page while it is under review (on hold)."
      );
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
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Public access page not found");
    }

    // 🔹 Disallow disabling if on-hold
    if (dealSite.status === "on-hold") {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "You cannot disable this public access page while it is under review (on hold)."
      );
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
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Public access page not found");
    }

    // Prevent slug update
    if (updates.publicSlug && updates.publicSlug !== dealSite.publicSlug) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Public slug cannot be changed once created."
      );
    }

    // 🔹 Disallow disabling if on-hold
    if (dealSite.status === "on-hold") {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "You cannot disable this public access page while it is under review (on hold)."
      );
    }

    Object.assign(dealSite, updates);
    await dealSite.save();

    return dealSite;
  }


  static async updateDealSiteSection(
    userId: string,
    publicSlug: string,
    sectionName: string,
    updates: Record<string, any>
  ): Promise<IDealSiteDoc> {
    await this.ensureActiveSubscription(userId);

    const dealSite = await DB.Models.DealSite.findOne({
      publicSlug,
      createdBy: userId,
    });

    if (!dealSite) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Public access page not found");
    }

    // Prevent slug changes
    if (updates.publicSlug && updates.publicSlug !== dealSite.publicSlug) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Public slug cannot be changed once created."
      );
    }
    
    // Disallow modifications if under review
    if (dealSite.status === "on-hold") {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "You cannot modify this public access page while it is under review (on hold)."
      );
    }

    // ✅ Supported sections list
    const allowedSections = [
      "brandingSeo",
      "theme",
      "inspectionSettings",
      "socialLinks",
      "contactVisibility",
      "featureSelection",
      "publicPage",
      "footer",
      "paymentDetails",
      "about",
      "contactUs",
      'homeSettings',
      'subscribeSettings',
      'support'
    ];

    if (!allowedSections.includes(sectionName)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        `Invalid section name. Allowed sections: ${allowedSections.join(", ")}`
      );
    }

    // ✅ Handle grouped flat fields (branding-seo)
  if (sectionName === "brandingSeo") {
    const brandingFields = [
      "title",
      "keywords",
      "description",
      "logoUrl",
    ];

    for (const key of Object.keys(updates)) {
      if (!brandingFields.includes(key)) {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          `Invalid field '${key}' for branding seo section. Allowed: ${brandingFields.join(", ")}`
        );
      }

      // directly update flat field
      (dealSite as any)[key] = updates[key];
    }
  } else {
    // ✅ For nested/grouped sections, merge the updates
    (dealSite as any)[sectionName] = {
      ...(dealSite as any)[sectionName],
      ...updates,
    };
  }

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
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Public access page not found");
    }

    await DB.Models.DealSite.deleteOne({ _id: dealSite._id });

    return {
      success: true,
      message: "Public access page deleted successfully",
    };
  }

  /**
   * Check if a publicSlug is available
   */
  static async isSlugAvailable(publicSlug: string): Promise<{ available: boolean; message: string }> {
    const existingSlug = await DB.Models.DealSite.findOne({ publicSlug }).lean();

    if (existingSlug) {
      return {
        available: false,
        message: "This slug is already taken. Please choose another.",
      };
    }

    return {
      available: true,
      message: "This slug is available.",
    };
  }



  /**
   * Fetch featured properties for a given DealSite
   * - If manual mode → uses propertyIds
   * - If auto mode → selects latest active properties
   */
  static async getFeaturedProperties(dealSite: IDealSiteDoc) {
    const Property = DB.Models.Property;

    if (!dealSite.featureSelection) {
      return [];
    }

    // Manual mode → specific IDs
    if (dealSite.featureSelection.mode === "manual" && dealSite.featureSelection.propertyIds) {
      const ids = dealSite.featureSelection.propertyIds
        .split(",")
        .map((id) => id.trim())
        .filter((id) => Types.ObjectId.isValid(id));

      return Property.find({ _id: { $in: ids }, isAvailable: true, isApproved: true, isDeleted: false })
        .limit(6)
        .lean();
    }

    // Auto mode → pick latest running properties by this agent
    return Property.find({
      createdBy: dealSite.createdBy,
      isAvailable: true,
      isApproved: true,
      isDeleted: false
    })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();
  }


}
