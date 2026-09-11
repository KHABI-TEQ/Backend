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
import { sortPreferenceLocationAlphabetically } from "../../../utils/sortLocationAlphabetically";
import { autoPairPreferenceById } from "../../../services/autoPreferencePairing.service";
import { dealSiteBaseUrlFromPublicSlug } from "../../../utils/matchedPropertiesDealSiteUrl";

/**
 * Edit an existing preference by submitting it as a new preference (original is left unchanged).
 * Triggers the same approval, email, and auto-matching flow as a fresh submit.
 */
export const updateBuyerPreferenceById = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { buyerId, preferenceId } = req.params;

    if (!buyerId || !preferenceId) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "buyerId and preferenceId are required",
      });
    }

    const original = await DB.Models.Preference.findOne({
      _id: preferenceId,
      buyer: buyerId,
    }).lean();

    if (!original) {
      return next(
        new RouteError(
          HttpStatusCodes.NOT_FOUND,
          "Preference not found for this buyer",
        ),
      );
    }

    const payload = await preferenceValidationSchema.validateAsync(req.body, {
      abortEarly: false,
    });

    const rawContactInfo = payload.contactInfo || {};
    const {
      fullName,
      email,
      phoneNumber,
      companyName,
      contactPerson,
      cacRegistrationNumber,
    } = rawContactInfo;

    const normalizedBuyerPayload = {
      fullName: fullName || companyName || "Unnamed Buyer",
      email: email || "unknown@example.com",
      phoneNumber: phoneNumber || "00000000000",
      ...(companyName && { companyName }),
      ...(contactPerson && { contactPerson }),
      ...(cacRegistrationNumber && { cacRegistrationNumber }),
    };

    const buyer = await DB.Models.Buyer.findById(buyerId);
    if (!buyer) {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Buyer not found"));
    }

    const sortedLocation = sortPreferenceLocationAlphabetically(payload.location);
    const submittedVia =
      payload.submittedVia === "app" || payload.submittedVia === "website"
        ? payload.submittedVia
        : original.submittedVia === "app"
          ? "app"
          : "website";

    const preferenceData = {
      ...payload,
      location: sortedLocation ?? payload.location,
      contactInfo: normalizedBuyerPayload,
      buyer: buyer._id,
      status: "pending",
      receiverMode: original.receiverMode || { type: "general" as const },
      submittedVia,
      clonedFromPreference: original._id,
    };

    const createdPreference = await DB.Models.Preference.create(preferenceData);
    createdPreference.status = "approved";
    await createdPreference.save();

    const userMailBody = preferenceMail({ ...preferenceData, status: "approved" });
    const userGeneralMail = generalEmailLayout(userMailBody);
    await sendEmail({
      to: buyer.email || normalizedBuyerPayload.email,
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

    let matchEmailBaseUrlOverride: string | undefined;
    if (
      original.receiverMode?.type === "dealSite" &&
      original.receiverMode.dealSiteID
    ) {
      const dealSite = await DB.Models.DealSite.findById(
        original.receiverMode.dealSiteID,
      )
        .select("publicSlug")
        .lean();
      const slug = String((dealSite as any)?.publicSlug || "").trim();
      if (slug) {
        matchEmailBaseUrlOverride = dealSiteBaseUrlFromPublicSlug(slug);
      }
    }

    try {
      await autoPairPreferenceById(createdPreference._id.toString(), {
        sendMatchEmail: true,
        sendNoMatchEmail: true,
        matchEmailBaseUrlOverride,
      });
    } catch (matchErr) {
      console.warn("[Preference clone] Auto pairing failed (non-fatal):", matchErr);
    }

    const responseData = createdPreference.toObject
      ? createdPreference.toObject()
      : createdPreference;
    if (responseData?.location) {
      responseData.location =
        sortPreferenceLocationAlphabetically(responseData.location) ??
        responseData.location;
    }

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Preference submitted as a new preference",
      data: {
        ...responseData,
        clonedFromPreferenceId: String(original._id),
      },
    });
  } catch (err: any) {
    if (err?.isJoi) {
      const message = err.details?.map((e: any) => e.message).join(", ");
      return next(new RouteError(HttpStatusCodes.BAD_REQUEST, message));
    }

    next(err);
  }
};
