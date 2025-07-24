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

export const postPropertyAsAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Validate payload
    const payload = await propertyValidationSchema.validateAsync(req.body, {
      abortEarly: false,
    });

    // Ensure the admin is assigning the property to a valid user
    const ownerId = payload.owner;
    const owner = await DB.Models.User.findById(ownerId);
    if (!owner) {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Owner not found"));
    }

    // Prepare final data for insertion
    const propertyData = {
      ...payload,
      owner: owner._id,
      createdByRole: req.user?.role || "admin",
      status: payload.status || "pending",
    };

    const createdProperty = await DB.Models.Property.create(propertyData);

    // Send Email to Property Owner
    const ownerMailBody = generatePropertyBriefEmail(
      owner.firstName || owner.fullName,
      createdProperty,
    );
    const ownerGeneralMailTemplate = generalTemplate(ownerMailBody);

    await sendEmail({
      to: owner.email,
      subject: "New Property Created",
      text: ownerGeneralMailTemplate,
      html: ownerGeneralMailTemplate,
    });

    // Send Email to Admin (self or super admin)
    const adminEmail = process.env.ADMIN_EMAIL || req.user.email || "";
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

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Property created successfully by admin",
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
