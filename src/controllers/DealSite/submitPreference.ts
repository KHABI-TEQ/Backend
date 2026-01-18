import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import { DB } from "..";
import { RouteError } from "../../common/classes";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { preferenceValidationSchema } from "../../validators/preference.validator";

import sendEmail from "../../common/send.email";
import { preferenceMail } from "../../common/emailTemplates/preference";
import { generalTemplate } from "../../common/email.template";
 
// ✅ Controller: Submit Preference from a DealSite
export const sendPreferenceRequest = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { publicSlug } = req.params;

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


    // ✅ Find DealSite
    const dealSite = await DB.Models.DealSite.findOne({ publicSlug }).lean();
    if (!dealSite) {
      res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        errorCode: "DEALSITE_NOT_FOUND",
        message: "DealSite not found",
        data: null,
      });
      return;
    }

    const {
      logoUrl,
      paymentDetails,
      title,
      footerSection,
      socialLinks = {},
    } = dealSite;

    const address = footerSection?.shortDescription || "Lagos, Nigeria";
    const dealSiteName = title || paymentDetails?.businessName || "Our Partner";

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

    // Prepare preference data
    const preferenceData = {
        ...payload,
        contactInfo: normalizedBuyerPayload,
        buyer: buyer._id,
        status: payload.status || "pending",
        receiverMode: {
            type: 'dealSite',
            dealSiteID: dealSite._id
        },
    };

    const createdPreference = await DB.Models.Preference.create(preferenceData);
    
    // Send email
    const userMailBody = preferenceMail(preferenceData);

    const userGeneralMail = generalTemplate(userMailBody, {
        companyName: dealSiteName,
        logoUrl:
        logoUrl ||
        "https://res.cloudinary.com/dkqjneask/image/upload/v1744050595/logo_1_flo1nf.png",
        address,
        facebookUrl: socialLinks.facebook || "",
        instagramUrl: socialLinks.instagram || "",
        linkedinUrl: socialLinks.linkedin || "",
        twitterUrl: socialLinks.twitter || "",
    });

    await sendEmail({
      to: buyer.email,
      subject: "Preference Submitted Successfully",
      text: userGeneralMail,
      html: userGeneralMail,
    });

    res.status(HttpStatusCodes.CREATED).json({
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
