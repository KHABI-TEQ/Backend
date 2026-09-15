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
import { assertCanListOffPlanIfRequested } from "../../../services/developerPlanEntitlement.service";
import { agentHasUnlimitedPropertyListings } from "../../../services/agentSubscriptionIncentive.service";
import { isAgentSubscriptionRequired } from "../../../services/agentPublisherEligibility.service";
import { validatePropertyPayload } from "../../../services/propertyValidation.service";
import { listingCommissionFields } from "../../../common/constants/listingCommission";
import mongoose from "mongoose";
import { autoPairPreferencesForNewProperty } from "../../../services/autoPreferencePairing.service";
import { enqueuePropertySyndicationJobs } from "../../../services/propertySyndication.service";
import { normalizeIsTenantedForDb } from "../../../utils/normalizeIsTenanted";
import { assertAgentListingPriceConsistent } from "../../../services/propertyDuplicatePrice.service";
import {
  persistPropertyImageEmbeddings,
  resolveEmbeddingsForUrls,
  syncPropertyImageEmbeddings,
} from "../../../services/propertyImageEmbedding.service";

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
    const isTenanted = normalizeIsTenantedForDb(payload.isTenanted);

    // Agent commission: Landlord/Developer only. Sale/off-plan 5%, rent 10%.
    const allowCommission = userType === "Landowners" || userType === "Developer";
    const propertyData = {
      ...payload,
      isTenanted,
      status: "approved",
      isApproved: true,
      isAvailable: true,
      ...(allowCommission
        ? listingCommissionFields(payload)
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

    // Publisher listing policy (25 cap / Portfolio Unlimited) for all listing roles
    let activeSnapshot = null;
    if (userType === "Agent" || userType === "Developer" || userType === "Landowners") {
      const { activeSnapshot: snap } = await assertPropertyListingAllowedForOwner({
        ownerId: userId,
        userType: userType as string,
      });
      activeSnapshot = snap;
    }

    const listingType = String(
      (formatted as { propertyType?: string }).propertyType || payload.propertyType || ""
    ).toLowerCase();
    await assertCanListOffPlanIfRequested({
      userId: String(userId),
      userType,
      propertyType: listingType,
    });

    const pictureUrls = Array.isArray((formatted as any).pictures)
      ? ((formatted as any).pictures as string[])
      : [];
    let preparedEmbeddings: Awaited<ReturnType<typeof resolveEmbeddingsForUrls>> = [];
    if (userType === "Agent") {
      try {
        preparedEmbeddings = await resolveEmbeddingsForUrls(pictureUrls);
      } catch (embedErr) {
        console.warn("[postProperty] image embedding failed (identity check still runs):", embedErr);
      }
      await assertAgentListingPriceConsistent({
        property: formatted,
        incomingEmbeddings: preparedEmbeddings,
      });
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
            owner: {
              email: req.user.email,
              firstName: req.user.firstName,
              lastName: req.user.lastName,
              fullName:
                req.user.fullName ||
                `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim(),
              phoneNumber: req.user.phoneNumber,
            },
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

    void (async () => {
      try {
        if (preparedEmbeddings.length) {
          await persistPropertyImageEmbeddings(String(createdProperty._id), preparedEmbeddings);
        } else {
          await syncPropertyImageEmbeddings(String(createdProperty._id), pictureUrls);
        }
      } catch (embedPersistErr) {
        console.warn("[postProperty] persist image embeddings failed:", embedPersistErr);
      }
    })();

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
