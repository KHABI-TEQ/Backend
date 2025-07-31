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

export const postProperty = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Validate payload
    // const payload = await propertyValidationSchema.validateAsync(req.body, {
    //   abortEarly: false,
    // });

    const payload = req.body; // skip Joi validation

    // Determine the creator role
    const createdByRole = req.user?.role || "user";

    // Prepare final data for insertion
    const propertyData = {
      ...payload,
      owner: req.user._id,
      createdByRole,
      status: payload.status || "pending",
    };

    const createdProperty = await DB.Models.Property.create(propertyData);

    // Send Email to Property Owner
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

    // Send Email to Admin
    const adminEmail = process.env.ADMIN_EMAIL || "";
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

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Property created successfully",
      data: createdProperty,
    });
  } catch (err: any) {
    if (err?.isJoi) {
      const message = err.details?.map((e: any) => e.message).join(", ");
      return next(new RouteError(HttpStatusCodes.BAD_REQUEST, message));
    }

    next(err);
  }
};
