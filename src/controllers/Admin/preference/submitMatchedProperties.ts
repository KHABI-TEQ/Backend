import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { Types } from "mongoose";
import sendEmail from "../../../common/send.email";
import { matchedPropertiesMail } from "../../../common/emailTemplates/preference";
import { generalEmailLayout } from "../../../common/emailTemplates/emailLayout";

export const selectMatchedPreferenceProperties = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { preferenceId, matchedPropertyIds = [], notes } = req.body;

    if (
      !preferenceId ||
      !Array.isArray(matchedPropertyIds) ||
      matchedPropertyIds.length === 0
    ) {
      return next(
        new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          "preferenceId and matchedPropertyIds are required",
        ),
      );
    }

    const preference = await DB.Models.Preference.findById(preferenceId).populate("buyer");
    if (!preference) {
      return next(
        new RouteError(HttpStatusCodes.NOT_FOUND, "Preference not found"),
      );
    }

    let matchedRecord;
    let wasUpdated = false;

    const existingRecord = await DB.Models.MatchedPreferenceProperty.findOne({
      preference: preferenceId,
      buyer: preference.buyer,
    });

    if (existingRecord) {
      const newUniqueIds = matchedPropertyIds.filter(
        (id: string) =>
          !existingRecord.matchedProperties.some((existingId) =>
            existingId.equals(id),
          ),
      );

      if (newUniqueIds.length > 0) {
        existingRecord.matchedProperties.push(
          ...newUniqueIds.map((id: string) => new Types.ObjectId(id)),
        );
        if (notes) existingRecord.notes = notes;
        await existingRecord.save();
        wasUpdated = true;
      }

      matchedRecord = existingRecord;
    } else {
      matchedRecord = await DB.Models.MatchedPreferenceProperty.create({
        preference: preferenceId,
        buyer: preference.buyer,
        matchedProperties: matchedPropertyIds.map(
          (id: string) => new Types.ObjectId(id),
        ),
        notes: notes || "",
      });
    }

    // Format location string
    const locationString = preference.location?.customLocation
      || `${preference.location.state}${preference.location.localGovernmentAreas?.length ? `, ${preference.location.localGovernmentAreas.join(", ")}` : ""}`;

    // Format price range
    const { minPrice, maxPrice, currency } = preference.budget;
    const priceRange = `${minPrice?.toLocaleString() || "N/A"} - ${maxPrice?.toLocaleString() || "N/A"} ${currency}`;

    // Select the correct details source
    let summaryData: any = {};
    switch (preference.preferenceType) {
      case "buy":
      case "rent":
        summaryData = preference.propertyDetails || {};
        break;
      case "joint-venture":
        summaryData = preference.developmentDetails || {};
        break;
      case "shortlet":
        summaryData = preference.bookingDetails || {};
        break;
    }

    // Construct preference summary for the email
    const preferenceSummary = {
      propertyType: summaryData.propertyType || "N/A",
      locationString,
      priceRange,
      usageOption: summaryData.purpose || "N/A",
      propertyFeatures: [
        ...(preference.features.baseFeatures || []),
        ...(preference.features.premiumFeatures || [])
      ].join(", ") || "Not specified",
      landSize: summaryData.landSize
        ? `${summaryData.landSize} ${summaryData.measurementUnit || ""}`
        : "N/A",
    };

    // Construct the link to matched properties
    const matchLink = `${process.env.CLIENT_LINK}/matched-properties/${matchedRecord._id}/${preferenceId}`;

    // Generate the email HTML body
    const mailBody = generalEmailLayout(
      matchedPropertiesMail({
        contactInfo: preference.contactInfo,
        preferenceSummary,
        matchCount: matchedPropertyIds.length,
        matchLink,
      }),
    );

    // Send the email
    await sendEmail({
      to: (preference.contactInfo as any).email,
      subject: `🎯 ${matchedPropertyIds.length} Property Match${matchedPropertyIds.length > 1 ? "es" : ""} Found for Your Preference`,
      html: mailBody,
      text: mailBody,
    });

    return res.status(
      wasUpdated ? HttpStatusCodes.OK : HttpStatusCodes.CREATED
    ).json({
      success: true,
      message: wasUpdated
        ? "Matched properties updated successfully"
        : "Matched properties saved successfully",
      data: matchedRecord,
    });
  } catch (err) {
    next(err);
  }
};
