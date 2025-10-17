
import { Response, NextFunction } from "express";
import { DB } from "../.."; 
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { AppRequest } from "../../../types/express";
import { generalEmailLayout } from "../../../common/emailTemplates/emailLayout";
import sendEmail from "../../../common/send.email";
import { PropertyApprovedOrDisapprovedTemplate } from "../../../common/emailTemplates/property";

export const setPropertyApprovalStatus = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { propertyId } = req.params;
    const { action } = req.body; // "approve" or "reject"

    if (!["approve", "reject"].includes(action)) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Invalid action. Use 'approve' or 'reject'",
      });
    }

    const update: Partial<{ isApproved: boolean; isRejected: boolean }> = {};
    if (action === "approve") {
      update.isApproved = true;
      update.isRejected = false;
    } else {
      update.isApproved = false;
      update.isRejected = true;
    }

    const updated = await DB.Models.Property.updateOne({ _id: propertyId }, update).exec();
    if (!updated.modifiedCount) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Property not found or update failed",
      });
    }

    const property = await DB.Models.Property.findById(propertyId).populate("owner").exec();
    if (!property || !property.owner) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Property or owner not found",
      });
    }

    const ownerName =
      (property.owner as any).fullName ||
      `${(property.owner as any).firstName || ""} ${(property.owner as any).lastName || ""}`.trim();

    const mailBody = generalEmailLayout(
      PropertyApprovedOrDisapprovedTemplate(
        ownerName,
        action === "approve" ? "approved" : "disapproved",
        property,
      ),
    );

    await sendEmail({
      to: (property.owner as any).email,
      subject: `Property ${action === "approve" ? "Approved" : "Rejected"}`,
      html: mailBody,
      text: mailBody,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: `Property ${action}d successfully.`,
    });
  } catch (error) {
    next(error);
  }
};