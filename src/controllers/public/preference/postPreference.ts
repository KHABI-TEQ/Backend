import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { preferenceValidationSchema } from "../../../validators/preference.validator";

import sendEmail from "../../../common/send.email";
import { generalEmailLayout } from "../../../common/emailTemplates/emailLayout";
import { preferenceMail } from "../../../common/emailTemplates/preference";

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

    // Prepare data to save
    const preferenceData = {
      ...payload,
      buyer: req.user._id,
      status: payload.status || "pending",
    };

    const createdPreference = await DB.Models.Preference.create(preferenceData);

    // Send Email to Buyer/User
    const userMailBody = preferenceMail(preferenceData);

    const userGeneralMail = generalEmailLayout(userMailBody);

    await sendEmail({
      to: req.user.email,
      subject: "Preference Submitted Successfully",
      text: userGeneralMail,
      html: userGeneralMail,
    });

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
