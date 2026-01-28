import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { propertyValidationSchema } from "../../../utils/formValidation/propertyValidationSchema";
import {
  generatePropertyBriefEmail,
  generatePropertySellBriefEmail,
  generalTemplate,
} from "../../../common/email.template";
import sendEmail from "../../../common/send.email";
import { formatPropertyPayload } from "../../../utils/propertiesFromatter.ts";
import { UserSubscriptionSnapshotService } from "../../../services/userSubscriptionSnapshot.service";
import mongoose from "mongoose";

export const postProperty = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // const payload = await propertyValidationSchema.validateAsync(req.body, {
    //   abortEarly: false,
    // });
    const { preferenceId } = req.params;
    const userId = req.user?._id;
    const payload = req.body; // skipping Joi for now

    if (!userId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
    }

    // Determine creator role
    const createdByRole = "user";
    const ownerModel = "User";

    const propertyData = {
      ...payload,
      status: payload.status || "pending",
    };

    const formatted = formatPropertyPayload(
      propertyData,
      userId,
      createdByRole,
      ownerModel
    );

    // ✅ Only check subscription for Agents, NOT for Landowners
    let activeSnapshot = null;
    if (req.user?.userType === "Agent") {
      activeSnapshot = await UserSubscriptionSnapshotService.getActiveSnapshot(userId);
      if (!activeSnapshot) {
        throw new RouteError(
          HttpStatusCodes.FORBIDDEN,
          "No active subscription. Please subscribe to a plan to post properties."
        );
      }
    }

    // ✅ Create property first (inside session)
    const [createdProperty] = await DB.Models.Property.create([formatted], { session });

    // ✅ Deduct quota after successful property creation (only if agent with active subscription)
    if (activeSnapshot) {
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

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Property created successfully",
      data: createdProperty,
    });

  } catch (err: any) {
    await session.abortTransaction();
    session.endSession();

    if (err?.isJoi) {
      const message = err.details?.map((e: any) => e.message).join(", ");
      return next(new RouteError(HttpStatusCodes.BAD_REQUEST, message));
    }

    return next(err);
  }
};
