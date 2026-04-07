import { DB } from "../controllers";
import { Types } from "mongoose";
import sendEmail from "../common/send.email";
import {
  matchedPropertiesMail,
  buildPreferenceLandSizeEmailLine,
} from "../common/emailTemplates/preference";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";
import { resolveMatchedPropertiesEmailBaseUrl } from "../utils/matchedPropertiesDealSiteUrl";

/**
 * Create or merge MatchedPreferenceProperty and optionally notify the buyer (same behavior as admin submit-matches).
 */
export async function persistMatchedPreferenceProperties(params: {
  preferenceId: string;
  matchedPropertyIds: Types.ObjectId[];
  notes?: string;
  sendMatchEmail: boolean;
  /** When true (admin submit-matches), notify even if no new property IDs were merged. */
  forceSendMatchEmail?: boolean;
  /**
   * When set (e.g. agent-initiated match from marketplace), match email CTA uses this origin
   * (e.g. https://slug.khabiteq.com) instead of resolving from listing owner/marketer.
   */
  matchEmailBaseUrlOverride?: string;
}): Promise<{ matchedRecord: any; wasUpdated: boolean } | null> {
  const {
    preferenceId,
    matchedPropertyIds,
    notes,
    sendMatchEmail,
    forceSendMatchEmail,
    matchEmailBaseUrlOverride,
  } = params;

  if (!matchedPropertyIds.length) return null;

  const preference = await DB.Models.Preference.findById(preferenceId).populate("buyer");
  if (!preference) return null;

  let matchedRecord: any;
  let wasUpdated = false;
  let addedCountForEmail = matchedPropertyIds.length;

  const existingRecord = await DB.Models.MatchedPreferenceProperty.findOne({
    preference: preferenceId,
    buyer: preference.buyer,
  });

  if (existingRecord) {
    const newUniqueIds = matchedPropertyIds.filter(
      (id) =>
        !existingRecord.matchedProperties.some((existingId) => existingId.equals(id)),
    );

    addedCountForEmail = newUniqueIds.length;

    if (newUniqueIds.length > 0) {
      existingRecord.matchedProperties.push(...newUniqueIds);
      if (notes) existingRecord.notes = notes;
      await existingRecord.save();
      wasUpdated = true;
    }

    matchedRecord = existingRecord;
  } else {
    matchedRecord = await DB.Models.MatchedPreferenceProperty.create({
      preference: preferenceId,
      buyer: preference.buyer,
      matchedProperties: matchedPropertyIds,
      notes: notes || "",
    });
  }

  const shouldEmail =
    sendMatchEmail &&
    matchedRecord &&
    (forceSendMatchEmail || wasUpdated || !existingRecord);

  if (!shouldEmail) {
    return matchedRecord ? { matchedRecord, wasUpdated } : null;
  }

  const locationString =
    preference.location?.customLocation ||
    `${preference.location.state}${
      preference.location.localGovernmentAreas?.length
        ? `, ${preference.location.localGovernmentAreas.join(", ")}`
        : ""
    }`;

  const { minPrice, maxPrice, currency } = preference.budget;
  const priceRange = `${minPrice?.toLocaleString() || "N/A"} - ${maxPrice?.toLocaleString() || "N/A"} ${currency}`;

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

  const preferenceSummary = {
    propertyType: summaryData.propertyType || "N/A",
    locationString,
    priceRange,
    usageOption: summaryData.purpose || "N/A",
    propertyFeatures:
      [...(preference.features.baseFeatures || []), ...(preference.features.premiumFeatures || [])].join(", ") ||
      "Not specified",
    landSize: buildPreferenceLandSizeEmailLine({
      propertyDetails: preference.propertyDetails,
      developmentDetails: preference.developmentDetails,
      bookingDetails: preference.bookingDetails,
    }),
  };

  const idsOrdered = (matchedRecord.matchedProperties || []).map((id: Types.ObjectId) => id);
  const propertyDocs = idsOrdered.length
    ? await DB.Models.Property.find({ _id: { $in: idsOrdered } }).lean()
    : [];
  const byId = new Map(propertyDocs.map((p: any) => [String(p._id), p]));
  const propertiesOrdered = idsOrdered
    .map((id: Types.ObjectId) => byId.get(String(id)))
    .filter(Boolean) as any[];
  const trimmedOverride = matchEmailBaseUrlOverride?.replace(/\/$/, "").trim();
  const matchBaseUrl = trimmedOverride
    ? trimmedOverride
    : await resolveMatchedPropertiesEmailBaseUrl(propertiesOrdered);
  const matchLink = `${matchBaseUrl}/matched-properties/${matchedRecord._id}/${preferenceId}`;

  const notifyCount = forceSendMatchEmail
    ? matchedPropertyIds.length
    : wasUpdated
      ? addedCountForEmail
      : matchedRecord!.matchedProperties.length;

  const mailBody = generalEmailLayout(
    matchedPropertiesMail({
      contactInfo: preference.contactInfo,
      preferenceSummary,
      matchCount: notifyCount,
      matchLink,
    }),
  );

  await sendEmail({
    to: (preference.contactInfo as any).email,
    subject: `🎯 ${notifyCount} Property Match${notifyCount > 1 ? "es" : ""} Found for Your Preference`,
    html: mailBody,
    text: mailBody,
  });

  return { matchedRecord, wasUpdated };
}
