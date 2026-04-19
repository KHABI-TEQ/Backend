import { Response, NextFunction } from "express";
import mongoose, { Types } from "mongoose";
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
import { validatePropertyPayload } from "../../../services/propertyValidation.service";
import { assertPropertyListingAllowedForOwner } from "../../../services/propertyListingEligibility.service";
import { autoPairPreferencesForNewProperty } from "../../../services/autoPreferencePairing.service";
import { notifyUserPropertyCreatedByAdmin } from "../../../services/userProvisioningNotifications.service";

export const postPropertyAsAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const validation = await validatePropertyPayload(req.body);
    if (!validation.success) {
      await session.abortTransaction();
      session.endSession();
      const message =
        validation.errors?.map((e) => `${e.field}: ${e.message}`).join(", ") ?? "Validation failed";
      return next(new RouteError(HttpStatusCodes.BAD_REQUEST, message));
    }

    const payload = validation.data;
    const ownerId = payload.owner;
    if (!ownerId) {
      await session.abortTransaction();
      session.endSession();
      return next(
        new RouteError(HttpStatusCodes.BAD_REQUEST, "owner (user id) is required for admin property creation.")
      );
    }

    const owner = await DB.Models.User.findById(ownerId).session(session);
    if (!owner) {
      await session.abortTransaction();
      session.endSession();
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Owner not found"));
    }

    const userType = String(owner.userType);
    const { activeSnapshot } = await assertPropertyListingAllowedForOwner({
      ownerId: owner._id as Types.ObjectId,
      userType,
    });

    const isTenanted = (payload.isTenanted ?? "no").toString().toLowerCase();
    const allowCommission = userType === "Landowners" || userType === "Developer";
    const propertyData = {
      ...payload,
      isTenanted,
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
      owner._id.toString(),
      "admin",
      "User"
    );

    if (userType === "Landowners" || userType === "Developer") {
      if (payload.listingScope === "lasrera_marketplace") {
        (formatted as any).listingScope = "lasrera_marketplace";
      }
    }
    if (userType === "Agent" && payload.listingScope === "lasrera_marketplace") {
      (formatted as any).listingScope = "agent_listing";
    }

    const wantsApproved = payload.status === "approved";
    (formatted as any).status = wantsApproved ? "approved" : "pending";
    (formatted as any).isApproved = wantsApproved;
    (formatted as any).isAvailable = wantsApproved;

    const [createdProperty] = await DB.Models.Property.create([formatted], { session });

    if (activeSnapshot) {
      try {
        await UserSubscriptionSnapshotService.adjustFeatureUsageByKey(
          activeSnapshot._id.toString(),
          "LISTINGS",
          1
        );
      } catch (err: any) {
        await session.abortTransaction();
        session.endSession();
        return next(new RouteError(HttpStatusCodes.FORBIDDEN, err.message));
      }
    }

    await session.commitTransaction();
    session.endSession();

    try {
      const ownerMailBody = generatePropertyBriefEmail(
        owner.firstName || (owner as any).fullName,
        createdProperty,
      );
      const ownerGeneralMailTemplate = generalTemplate(ownerMailBody);
      await sendEmail({
        to: owner.email,
        subject: "New Property Created",
        text: ownerGeneralMailTemplate,
        html: ownerGeneralMailTemplate,
      });
    } catch (emailErr) {
      console.warn("[EMAIL] Failed to send owner email (admin create):", emailErr);
    }

    try {
      const adminEmail = process.env.ADMIN_EMAIL || (req as any).admin?.email || "";
      if (adminEmail) {
        const adminMailBody = generalTemplate(
          generatePropertySellBriefEmail({
            ...createdProperty.toObject(),
            isAdmin: true,
          }),
        );
        await sendEmail({
          to: adminEmail,
          subject: "New Property Created by Admin",
          text: adminMailBody,
          html: adminMailBody,
        });
      }
    } catch (emailErr) {
      console.warn("[EMAIL] Failed to send admin email:", emailErr);
    }

    try {
      const loc = createdProperty.location as { area?: string; state?: string } | undefined;
      const summaryLine = `${createdProperty.propertyType ?? "Property"} — ${loc?.area ?? ""}, ${loc?.state ?? ""}`.trim();
      await notifyUserPropertyCreatedByAdmin({
        email: owner.email,
        firstName: owner.firstName,
        phoneNumber: owner.phoneNumber,
        summaryLine: summaryLine || "A new listing was added to your account.",
      });
    } catch (waErr) {
      console.warn("[notifyUserPropertyCreatedByAdmin]", waErr);
    }

    try {
      await autoPairPreferencesForNewProperty(createdProperty._id.toString());
    } catch (pairErr) {
      console.warn("[postPropertyAsAdmin] autoPairPreferencesForNewProperty failed:", pairErr);
    }

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Property created successfully by admin",
      data: createdProperty,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
};
