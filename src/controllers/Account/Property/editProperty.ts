import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { propertyValidationSchema } from "../../../utils/formValidation/propertyValidationSchema";

export const editProperty = async (
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

    // Fetch property from DB
    const property = await DB.Models.Property.findById(propertyId);
    if (!property) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Property not found");
    }

    // Check ownership or admin privilege
    if (
      property.owner.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "You do not have permission to edit this property",
      );
    }

    // Merge and save updates
    Object.assign(property, payload);
    property.status = payload.status || property.status;

    await property.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Property updated successfully",
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

export const updatePropertyStatus = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { propertyId } = req.params;
    const { status, reason } = req.body;

    if (!status) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Status is required");
    }

    // Fetch property from DB
    const property = await DB.Models.Property.findById(propertyId);
    if (!property) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Property not found");
    }

    // Restrict updates for pending or deleted properties
    if (["pending", "deleted", "rejected", "hold", "flagged"].includes(property.status)) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        `You cannot change the status of a ${property.status} property.`
      );
    }

    const inactiveStatuses = [
      "withdrawn",
      "unavailable",
      "expired",
      "coming_soon",
      "under_contract",
      "sold",
      "flagged",
      "cancelled",
      "temporarily_off_market",
      "hold",
      "failed",
      "never_listed",
      "rejected",
      "deleted",
    ];

    const activeStatuses = [
      "approved",
      "available",
      "active",
      "back_on_market",
    ];

    // Dynamically toggle availability
    property.isAvailable = activeStatuses.includes(status);

    // Update other fields
    property.status = status;
    if (reason) property.reason = reason;

    await property.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Property status updated successfully",
      data: property,
    });
  } catch (err) {
    next(err);
  }
};

