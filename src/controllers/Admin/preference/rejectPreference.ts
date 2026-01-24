import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import sendEmail from "../../../common/send.email";
import { generalEmailLayout } from "../../../common/emailTemplates/emailLayout";
import { rejectedPreferenceMail } from "../../../common/emailTemplates/preference";

export const rejectPreference = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { preferenceId } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(preferenceId)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Invalid preference ID",
      );
    }

    const preference = await DB.Models.Preference
      .findById(preferenceId)
      .populate("buyer", "fullName email phoneNumber");

    if (!preference) {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        "Preference not found",
      );
    }

    if (preference.status === "rejected") {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Preference is already rejected",
      );
    }

    // Update status
    preference.status = "rejected";
    await preference.save();

    // -------------------------------
    // Buyer details (POPULATED)
    // -------------------------------
    const buyer = preference.buyer as any;

    const buyerDetails = {
      fullName: buyer?.fullName,
      email: buyer?.email,
      phoneNumber: buyer?.phoneNumber,
    };

    // -------------------------------
    // Preference summary
    // -------------------------------
    const preferenceSummary = {
      propertyType:
        preference.propertyDetails?.propertyType ||
        preference.bookingDetails?.propertyType ||
        "N/A",

      locationString: preference.location
        ? [
            preference.location.state,
            preference.location.localGovernmentAreas?.join(", "),
          ]
            .filter(Boolean)
            .join(", ")
        : "N/A",

      priceRange: preference.budget
        ? `${preference.budget.minPrice || 0} - ${
            preference.budget.maxPrice || 0
          } ${preference.budget.currency || "NGN"}`
        : "N/A",

      usageOption: preference.preferenceMode || "N/A",

      propertyFeatures: preference.features?.baseFeatures?.length
        ? preference.features.baseFeatures.join(", ")
        : "Not specified",

      landSize:
        preference.propertyDetails?.landSize ||
        preference.developmentDetails?.minLandSize ||
        preference.bookingDetails?.landSize ||
        "N/A",
    };

    // -------------------------------
    // Email body
    // -------------------------------
    const mailBody = generalEmailLayout(
      rejectedPreferenceMail({
        buyerDetails,
        contactInfo: preference.contactInfo,
        preferenceSummary,
        rejectionReason: reason,
        updatePreferenceLink: `${process.env.FRONTEND_URL}/update-preference/${buyer._id}/${preference._id}`,
      }),
    );

    // -------------------------------
    // Send email
    // -------------------------------
    await sendEmail({
      to: buyerDetails.email || (preference.contactInfo as any).email,
      subject: "Update on Your Property Preference Submission",
      html: mailBody,
      text: mailBody,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Preference rejected successfully",
      data: preference,
    });
  } catch (err) {
    next(err);
  }
};
