import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";

export const updatePropertyStatusAsAdmin = async (
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

    const property = await DB.Models.Property.findById(propertyId);
    if (!property) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Property not found");
    }

    const inactiveStatuses = [
      "withdrawn",
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
      "active",
      "back_on_market",
      "pending",
    ];

    // Update status & reason
    property.status = status;
    property.reason = reason || property.reason;

    // Update availability
    property.isAvailable = activeStatuses.includes(status);

    // Set isRejected flag
    property.isRejected = status === "rejected";

    await property.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Property status updated by admin",
      data: property,
    });
  } catch (err) {
    next(err);
  }
};
