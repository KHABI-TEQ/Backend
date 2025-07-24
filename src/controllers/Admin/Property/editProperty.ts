import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { propertyValidationSchema } from "../../../utils/formValidation/propertyValidationSchema";

export const editPropertyAsAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { propertyId } = req.params;

    // Validate payload
    const payload = await propertyValidationSchema.validateAsync(req.body, {
      abortEarly: false,
    });

    // Fetch property
    const property = await DB.Models.Property.findById(propertyId);
    if (!property) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Property not found");
    }

    // Ensure only admin access
    if (req.user.role !== "admin") {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Only admin can perform this action",
      );
    }

    // Update
    Object.assign(property, payload);
    property.status = payload.status || property.status;

    await property.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Property updated successfully by admin",
      data: property,
    });
  } catch (err: any) {
    if (err?.isJoi) {
      const message = err.details?.map((e: any) => e.message).join(", ");
      return next(new RouteError(HttpStatusCodes.BAD_REQUEST, message));
    }
    next(err);
  }
};
