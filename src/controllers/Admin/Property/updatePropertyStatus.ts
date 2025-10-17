import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { generalEmailLayout } from "../../../common/emailTemplates/emailLayout";
import { PropertyApprovedOrDisapprovedTemplate } from "../../../common/emailTemplates/property";
import sendEmail from "../../../common/send.email";

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
      "pending",
    ];

    const activeStatuses = ["approved", "active", "back_on_market"];

    // Update property status and reason
    property.status = status;
    property.reason = reason ?? property.reason;

    // Set availability and approval flags
    const isActive = activeStatuses.includes(status);
    property.isAvailable = isActive;
    property.isApproved = isActive;

    // Set rejection flag
    property.isRejected = status === "rejected";

    // Send email only if status is "approved" or "rejected"
    if (status === "approved" || status === "rejected") {
      const ownerName =
        (property.owner as any).fullName ||
        `${(property.owner as any).firstName || ""} ${(property.owner as any).lastName || ""}`.trim();

      const mailBody = generalEmailLayout(
        PropertyApprovedOrDisapprovedTemplate(ownerName, status, property),
      );

      await sendEmail({
        to: (property.owner as any).email,
        subject: `Property ${status === "approved" ? "Approved" : "Rejected"}`,
        html: mailBody,
        text: mailBody,
      });
    }

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

