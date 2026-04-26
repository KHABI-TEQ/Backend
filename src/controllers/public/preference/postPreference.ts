import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { preferenceValidationSchema } from "../../../validators/preference.validator";

import sendEmail from "../../../common/send.email";
import { generalEmailLayout } from "../../../common/emailTemplates/emailLayout";
import { preferenceMail } from "../../../common/emailTemplates/preference";
import { isLikelyE164CapableLocalPhone, runWhatsapp } from "../../../services/whatsappClient.service";
import { preferencePayloadToUserPreferences } from "../../../utils/preferenceUserPreferencesForWhatsapp";

export const postPreference = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Validate payload
    const payload = await preferenceValidationSchema.validateAsync(req.body, {
      abortEarly: false,
    });

    const rawContactInfo = payload.contactInfo || {};

    // Extract only expected fields
    const {
      fullName,
      email,
      phoneNumber,
      companyName,
      contactPerson,
      cacRegistrationNumber,
    } = rawContactInfo;

    // Ensure required fields for Buyer model
    const normalizedBuyerPayload: {
      fullName: string;
      email: string;
      phoneNumber: string;
      companyName?: string;
      contactPerson?: string;
      cacRegistrationNumber?: string;
    } = {
      fullName: fullName || companyName || "Unnamed Buyer",
      email: email || "unknown@example.com", // fallback email
      phoneNumber: phoneNumber || "00000000000", // fallback phone number
      ...(companyName && { companyName }),
      ...(contactPerson && { contactPerson }),
      ...(cacRegistrationNumber && { cacRegistrationNumber }),
    };

    // Check if buyer already exists
    let buyer = await DB.Models.Buyer.findOne({
      $or: [
        { email: normalizedBuyerPayload.email },
        {
          fullName: normalizedBuyerPayload.fullName,
          phoneNumber: normalizedBuyerPayload.phoneNumber,
        },
      ],
    });

    if (!buyer) {
      buyer = await DB.Models.Buyer.create(normalizedBuyerPayload);
    }

    // Prepare preference data (initially pending; we auto-approve below)
    const preferenceData = {
      ...payload,
      contactInfo: normalizedBuyerPayload,
      buyer: buyer._id,
      status: payload.status || "pending",
      receiverMode: { type: "general" as const },
    };

    const createdPreference = await DB.Models.Preference.create(preferenceData);

    createdPreference.status = "approved";
    await createdPreference.save();

    // Send email (with approved status)
    const userMailBody = preferenceMail({ ...preferenceData, status: "approved" });
    const userGeneralMail = generalEmailLayout(userMailBody);

    await sendEmail({
      to: buyer.email,
      subject: "Preference Submitted Successfully",
      text: userGeneralMail,
      html: userGeneralMail,
    });

    const contactPhone = (
      (buyer as any).whatsAppNumber ||
      (buyer as any).phoneNumber ||
      phoneNumber ||
      ""
    )
      .toString()
      .replace(/\s/g, "");
    if (isLikelyE164CapableLocalPhone(contactPhone)) {
      void runWhatsapp("preference_submitted_whatsapp", async (wa) => {
        const prefs = preferencePayloadToUserPreferences(preferenceData as any);
        await wa.sendPreferencesSaved({
          user: {
            name: (buyer as any).fullName || "there",
            phone: contactPhone,
            id: String(buyer._id),
          },
          preferences: prefs,
        });
      });
    }

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Preference submitted successfully",
      data: createdPreference,
    });
  } catch (err: any) {
    if (err?.isJoi) {
      const message = err.details?.map((e: any) => e.message).join(", ");
      return next(new RouteError(HttpStatusCodes.BAD_REQUEST, message));
    }

    next(err);
  }
};
