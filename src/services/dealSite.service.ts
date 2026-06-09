import { DB } from "../controllers";
import HttpStatusCodes from "../common/HttpStatusCodes";
import { RouteError } from "../common/classes";
import { IDealSite, IDealSiteDoc } from "../models";
import { Types } from "mongoose";
import { PaystackService } from "./paystack.service";
import { UserSubscriptionSnapshotService } from "./userSubscriptionSnapshot.service";
import { resolveLeanRefToObjectId } from "../utils/mongooseId";
import {
  assertDealSiteKycAllowed,
  getPublicDealSiteKycGate,
} from "./dealSiteKycEligibility.service";
import { getAgentAccessGate } from "./agentPublisherEligibility.service";

const confidentialFields = "-paymentDetails -createdBy -__v";

export class DealSiteService {

  /**
   * Sets up a DealSite (public access page) for an Agent or Developer.
   * - Ensures uniqueness of publicSlug
   * - Ensures the user cannot create multiple DealSites
   * - Persists the DealSite with defaults and relations
   * - Does not require an active subscription (subscription is enforced for property listing tiers, not DealSite).
   */
  static async setUpPublicAccess(
    userId: string,
    payload: Partial<IDealSite>,
    options?: { skipPaymentDetails?: boolean }
  ): Promise<IDealSiteDoc> {
    const owner = await DB.Models.User.findById(userId).select("userType").lean();
    if (!owner) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "User not found");
    }
    if (owner.userType !== "Agent" && owner.userType !== "Developer") {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Only agents and developers can set up a public access page."
      );
    }

    await assertDealSiteKycAllowed(userId);

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

    // Ensure the user doesn’t already have a DealSite
    const existingUserSite = await DB.Models.DealSite.findOne({
      createdBy: userId,
    });

    if (existingUserSite) {
      throw new RouteError(
        HttpStatusCodes.CONFLICT,
        "You already have a Public access page created."
      );
    }

    const skipPaymentDetails = options?.skipPaymentDetails === true;
    if (!payload.paymentDetails && !skipPaymentDetails) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Bank details are required to set up a Public access page"
      );
    }

    if (payload.paymentDetails) {
      payload.paymentDetails = await DealSiteService.buildSubAccountPaymentDetails(
        payload.paymentDetails
      );
    }

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
   * Fetch DealSites for a specific user (Agent or Developer public page owner).
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

    const dealSite = await DB.Models.DealSite.findOne({
      publicSlug,
      createdBy: userId,
    });

    if (!dealSite) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Public access page not found");
    }

    await assertDealSiteKycAllowed(userId);

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
    dealSite.pausedByPolicy = undefined;
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
    } else if (sectionName === "paymentDetails") {
      const mergedPaymentDetails = {
        ...(dealSite as any).paymentDetails,
        ...updates,
      };
      (dealSite as any).paymentDetails =
        await DealSiteService.buildSubAccountPaymentDetails(mergedPaymentDetails);
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

  private static async buildSubAccountPaymentDetails(paymentDetails: any) {
    const businessName = String(paymentDetails?.businessName || "").trim();
    const sortCode = String(paymentDetails?.sortCode || "").trim();
    const accountNumber = String(paymentDetails?.accountNumber || "").trim();
    const primaryContactEmail = paymentDetails?.primaryContactEmail || null;
    const primaryContactName = paymentDetails?.primaryContactName || null;
    const primaryContactPhone = paymentDetails?.primaryContactPhone || null;

    if (!businessName || !sortCode || !accountNumber) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "paymentDetails.businessName, paymentDetails.sortCode and paymentDetails.accountNumber are required"
      );
    }

    const subAccountResponse = await PaystackService.createSubaccount({
      businessName,
      settlementBank: sortCode,
      accountNumber,
      percentageCharge: 15,
      primaryContactEmail: primaryContactEmail || undefined,
      primaryContactName: primaryContactName || undefined,
      primaryContactPhone: primaryContactPhone || undefined,
    });

    return {
      ...paymentDetails,
      subAccountCode: subAccountResponse.subAccountCode,
      accountNumber: subAccountResponse.accountNumber,
      businessName,
      accountName: subAccountResponse.accountName,
      accountBankName: subAccountResponse.accountBankName,
      sortCode,
      percentageCharge: subAccountResponse.percentageCharge,
      isVerified: subAccountResponse.isVerified,
      active: subAccountResponse.active,
      primaryContactEmail,
      primaryContactName,
      primaryContactPhone,
    };
  }



  /**
   * Delete a DealSite permanently
   */
  static async deleteDealSite(
    userId: string,
    publicSlug: string
  ): Promise<{ success: boolean; message: string }> {
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
    // if ((dealSite.featureSelection.mode === "manual" || dealSite.featureSelection.mode === "auto") && dealSite.featureSelection.propertyIds) {
    //   const ids = dealSite.featureSelection.propertyIds
    //     .split(",")
    //     .map((id) => id.trim())
    //     .filter((id) => Types.ObjectId.isValid(id));

    //   return Property.find({ _id: { $in: ids }, isAvailable: true, isApproved: true, isDeleted: false })
    //     .limit(6)
    //     .lean();
    // }

    // Manual / Auto → specific IDs
    if (
      (dealSite.featureSelection.mode === "manual" ||
        dealSite.featureSelection.mode === "auto") &&
      Array.isArray(dealSite.featureSelection.featuredListings) &&
      dealSite.featureSelection.featuredListings.length > 0
    ) {
      const ids = dealSite.featureSelection.featuredListings
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id));

      return Property.find({
        _id: { $in: ids },
        isAvailable: true,
        isApproved: true,
        isDeleted: false,
      })
        .limit(6)
        .lean();
    }

    // Auto mode → pick latest properties owned or marketed by this DealSite creator (multiple agents can market the same property)
    const creatorId = resolveLeanRefToObjectId(dealSite.createdBy);
    if (!creatorId) {
      return [];
    }
    return Property.find({
      $or: [
        { owner: creatorId },
        { marketedByAgentIds: creatorId },
        { marketedByAgentId: creatorId }, // legacy single field
      ],
      isAvailable: true,
      isApproved: true,
      isDeleted: false
    })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();
  }

  /**
   * Public DealSite (visitor): Agent owners must satisfy trial/subscription rules;
   * Developers are not gated by subscription.
   */
  static async getPublicDealSiteSubscriptionGate(
    ownerUserId: string
  ): Promise<
    | { readonly ok: true }
    | { readonly ok: false; readonly errorCode: string; readonly message: string }
  > {
    const owner = await DB.Models.User.findById(ownerUserId).select("userType").lean();
    if (!owner || owner.userType !== "Agent") {
      return { ok: true } as const;
    }

    const gate = await getAgentAccessGate(ownerUserId);
    if (gate.ok) {
      return { ok: true } as const;
    }
    if (gate.ok === false && gate.reason === "kyc") {
      return { ok: true } as const;
    }
    if (gate.ok === false) {
      return {
        ok: false,
        errorCode: "SUBSCRIPTION_REQUIRED",
        message: gate.message,
      } as const;
    }
    return { ok: true } as const;
  }

  /** Public visitor gate: Agent owners must satisfy KYC grace and trial/subscription rules. */
  static async getPublicDealSiteKycGate(ownerUserId: string) {
    return getPublicDealSiteKycGate(ownerUserId);
  }

  /**
   * Validates whether a DealSite may be served to public visitors (running + KYC + subscription rules).
   * Pauses the page when KYC grace has expired without approval.
   */
  static async validatePublicDealSiteVisitorAccess(dealSite: {
    _id?: unknown;
    status?: string;
    createdBy?: unknown;
  }): Promise<
    | { readonly ok: true }
    | {
        readonly ok: false;
        readonly httpStatus: number;
        readonly errorCode: string;
        readonly message: string;
      }
  > {
    if (dealSite.status !== "running") {
      return {
        ok: false,
        httpStatus: HttpStatusCodes.FORBIDDEN,
        errorCode: "DEALSITE_NOT_ACTIVE",
        message: "This Public access page is not currently active.",
      } as const;
    }

    const ownerId = resolveLeanRefToObjectId(dealSite.createdBy);
    if (!ownerId) {
      return {
        ok: false,
        httpStatus: HttpStatusCodes.INTERNAL_SERVER_ERROR,
        errorCode: "DEALSITE_INVALID_OWNER",
        message: "Public access page owner reference is invalid.",
      } as const;
    }

    const kycGate = await getPublicDealSiteKycGate(ownerId.toString());
    if (kycGate.ok === false) {
      void DealSiteService.pauseDealSiteForKycIfNeeded(dealSite);
      return {
        ok: false,
        httpStatus: HttpStatusCodes.FORBIDDEN,
        errorCode: kycGate.errorCode,
        message: kycGate.message,
      } as const;
    }

    const subscriptionGate = await DealSiteService.getPublicDealSiteSubscriptionGate(
      ownerId.toString()
    );
    if (subscriptionGate.ok === false) {
      void DealSiteService.pauseDealSiteForPolicyIfNeeded(dealSite, "subscription");
      return {
        ok: false,
        httpStatus: HttpStatusCodes.OK,
        errorCode: subscriptionGate.errorCode,
        message: subscriptionGate.message,
      } as const;
    }

    return { ok: true } as const;
  }

  /** Pause a running DealSite when the Agent owner fails KYC/subscription policy checks. */
  static async pauseDealSiteForKycIfNeeded(dealSite: {
    _id?: unknown;
    status?: string;
    createdBy?: unknown;
  }): Promise<void> {
    const ownerId = resolveLeanRefToObjectId(dealSite.createdBy);
    if (!ownerId) {
      return;
    }

    const gate = await getPublicDealSiteKycGate(ownerId.toString());
    if (gate.ok === false) {
      const reason = gate.errorCode === "KYC_REQUIRED" ? "kyc" : "subscription";
      await DealSiteService.pauseDealSiteForPolicyIfNeeded(dealSite, reason);
    }
  }

  static async pauseDealSiteForPolicyIfNeeded(
    dealSite: { _id?: unknown; status?: string },
    reason: "kyc" | "subscription"
  ): Promise<void> {
    if (dealSite.status !== "running") {
      return;
    }

    await DB.Models.DealSite.updateOne(
      { _id: dealSite._id, status: "running" },
      { $set: { status: "paused", pausedByPolicy: reason } }
    );
  }

}
