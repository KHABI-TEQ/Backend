import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { generalEmailLayout } from "../../../common/emailTemplates/emailLayout";
import { PropertyApprovedOrDisapprovedTemplate } from "../../../common/emailTemplates/property";
import sendEmail from "../../../common/send.email";
import {
  autoPairPreferencesForNewProperty,
  isPropertyListedAndMatchable,
} from "../../../services/autoPreferencePairing.service";
import { enqueuePropertySyndicationJobs } from "../../../services/propertySyndication.service";
import {
  isLivePropertyStatus,
  isRemovedPropertyStatus,
} from "../../../utils/liveListingFilter";

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

    if (isRemovedPropertyStatus(status)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Listing status 'active'/'inactive' is not used. On-market listings use status 'approved' with isAvailable true.",
      );
    }

    const property = await DB.Models.Property.findById(propertyId);
    if (!property) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Property not found");
    }

    property.status = status;
    property.reason = reason ?? property.reason;

    const isLive = isLivePropertyStatus(status);
    property.isAvailable = isLive;
    property.isApproved = isLive;

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

    const propLean = await DB.Models.Property.findById(propertyId).lean();
    if (propLean && isPropertyListedAndMatchable(propLean)) {
      try {
        await autoPairPreferencesForNewProperty(propertyId);
      } catch (e) {
        console.warn("[updatePropertyStatusAsAdmin] autoPairPreferencesForNewProperty failed:", e);
      }
    }

    try {
      void enqueuePropertySyndicationJobs({
        propertyId: propertyId.toString(),
        userId: property.owner.toString(),
        eventType: status === "deleted" || status === "withdrawn" ? "property.unpublished" : "property.status_changed",
      });
    } catch (syndicationErr) {
      console.warn("[updatePropertyStatusAsAdmin] enqueue syndication failed:", syndicationErr);
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Property status updated by admin",
      data: property,
    });
  } catch (err) {
    next(err);
  }
};

