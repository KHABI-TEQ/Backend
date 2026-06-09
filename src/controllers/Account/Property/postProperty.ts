import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import {
  generatePropertyBriefEmail,
  generatePropertySellBriefEmail,
  generalTemplate,
} from "../../../common/email.template";
import sendEmail from "../../../common/send.email";
import { formatPropertyPayload } from "../../../utils/propertiesFromatter.ts";
import { UserSubscriptionSnapshotService } from "../../../services/userSubscriptionSnapshot.service";
import { assertPropertyListingAllowedForOwner } from "../../../services/propertyListingEligibility.service";
import { agentHasUnlimitedPropertyListings } from "../../../services/agentSubscriptionIncentive.service";
import { isAgentSubscriptionRequired } from "../../../services/agentPublisherEligibility.service";
import { validatePropertyPayload } from "../../../services/propertyValidation.service";
import mongoose from "mongoose";
import { autoPairPreferencesForNewProperty } from "../../../services/autoPreferencePairing.service";
import { enqueuePropertySyndicationJobs } from "../../../services/propertySyndication.service";

export const postProperty = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { preferenceId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
    }

    const validation = await validatePropertyPayload(req.body);
    if (!validation.success) {
      const message = validation.errors?.map((e) => `${e.field}: ${e.message}`).join(", ") ?? "Validation failed";
      return next(new RouteError(HttpStatusCodes.BAD_REQUEST, message));
    }

    const payload = validation.data;
    const createdByRole = "user";
    const ownerModel = "User";
    const userType = (req.user as any)?.userType;

    // Normalize isTenanted: API accepts "Yes"/"No", Mongoose enum expects "yes"/"no"/"i-live-in-it"
    const isTenanted = (payload.isTenanted ?? "no").toString().toLowerCase();

    // Agent commission fields: only persist for Landlord or Developer (Sale, Rent, JV, Shortlet)
    const allowCommission = userType === "Landowners" || userType === "Developer";
    const propertyData = {
      ...payload,
      isTenanted,
      status: "approved",
      isApproved: true,
      isAvailable: true,
      ...(allowCommission
        ? {}
        : { agentCommissionPercent: undefined, agentCommissionAmount: undefined }),
    };
    if (!allowCommission) {
      delete (propertyData as any).agentCommissionPercent;
      delete (propertyData as any).agentCommissionAmount;
    }

    const formatted = formatPropertyPayload(
      propertyData,
      userId,
      createdByRole,
      ownerModel
    );

    if (userType === "Landowners" || userType === "Developer") {
      if (payload.listingScope === "lasrera_marketplace") {
        (formatted as any).listingScope = "lasrera_marketplace";
      }
    }
    if (userType === "Agent" && payload.listingScope === "lasrera_marketplace") {
      (formatted as any).listingScope = "agent_listing";
    }

    // ✅ Agents: KYC grace, 4-week trial (up to 10 listings), then subscription required
    let activeSnapshot = null;
    if (req.user?.userType === "Agent") {
      const { activeSnapshot: snap } = await assertPropertyListingAllowedForOwner({
        ownerId: userId,
        userType: req.user.userType as string,
      });
      activeSnapshot = snap;
    }

    // ✅ Create property first (inside session)
    const [createdProperty] = await DB.Models.Property.create([formatted], { session });

    // Paid practitioner subscriptions include unlimited listings (no LISTINGS quota deduction).
    const unlimitedListings =
      userType === "Agent" ? await agentHasUnlimitedPropertyListings(String(userId)) : false;
    const subscriptionRequired =
      userType === "Agent" ? await isAgentSubscriptionRequired(String(userId)) : false;

    // ✅ Deduct quota only when a paid subscription is required and listings are not unlimited.
    if (activeSnapshot && subscriptionRequired && !unlimitedListings) {
      try {
        if (preferenceId) {
          await UserSubscriptionSnapshotService.adjustFeatureUsageByKey(
            activeSnapshot._id.toString(),
            "AGENT_MARKETPLACE",
            1
          );
        } else {
          await UserSubscriptionSnapshotService.adjustFeatureUsageByKey(
            activeSnapshot._id.toString(),
            "LISTINGS",
            1
          );
        }
      } catch (err: any) {
        // rollback property creation if quota fails
        await session.abortTransaction();
        session.endSession();
        return next(new RouteError(HttpStatusCodes.FORBIDDEN, err.message));
      }
    }

    await session.commitTransaction();
    session.endSession();

    // ✅ Send Email to Property Owner (non-blocking)
    try {
      const ownerMailBody = generatePropertyBriefEmail(
        req.user.firstName || req.user.fullName,
        createdProperty,
      );

      const ownerGeneralMailTemplate = generalTemplate(ownerMailBody);

      await sendEmail({
        to: req.user.email,
        subject: "New Property Created",
        text: ownerGeneralMailTemplate,
        html: ownerGeneralMailTemplate,
      });
    } catch (emailErr) {
      console.warn("[EMAIL] Failed to send owner email:", emailErr);
    }

    // ✅ Send Email to Admin (non-blocking)
    try {
      const adminEmail = process.env.ADMIN_EMAIL || "";
      if (adminEmail) {
        const adminMailBody = generalTemplate(
          generatePropertySellBriefEmail({
            ...createdProperty.toObject(),
            isAdmin: true,
          }),
        );

        await sendEmail({
          to: adminEmail,
          subject: "New Property Created",
          text: adminMailBody,
          html: adminMailBody,
        });
      }
    } catch (emailErr) {
      console.warn("[EMAIL] Failed to send admin email:", emailErr);
    }

    try {
      await autoPairPreferencesForNewProperty(createdProperty._id.toString());
    } catch (pairErr) {
      console.warn("[postProperty] autoPairPreferencesForNewProperty failed:", pairErr);
    }

    try {
      void enqueuePropertySyndicationJobs({
        propertyId: createdProperty._id.toString(),
        userId: userId.toString(),
        eventType: "property.created",
      });
    } catch (syndicationErr) {
      console.warn("[postProperty] enqueue syndication failed:", syndicationErr);
    }

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Property created successfully",
      data: createdProperty,
    });

  } catch (err: any) {
    await session.abortTransaction();
    session.endSession();
    return next(err);
  }
};
