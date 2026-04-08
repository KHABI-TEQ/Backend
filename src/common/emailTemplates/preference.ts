/**
 * Buyer-facing label for land units: legacy hectare-style values show as "acres";
 * plot, sqm, and acres stay readable.
 */
export function formatPreferenceMeasurementUnitForEmail(
  unit: string | undefined | null,
): string {
  const u = String(unit ?? "").trim().toLowerCase();
  if (!u) return "";
  if (u === "hectares" || u === "hectare" || u === "ha") return "acres";
  if (u === "sqm") return "sqm";
  if (u === "plot") return "plot";
  if (u === "acres") return "acres";
  return String(unit ?? "").trim();
}

/** Single line for "Land Size" in preference emails (buy / rent / JV / shortlet). */
export function buildPreferenceLandSizeEmailLine(payload: {
  propertyDetails?: {
    landSize?: string;
    minLandSize?: string;
    maxLandSize?: string;
    measurementUnit?: string;
  };
  developmentDetails?: { minLandSize?: string; maxLandSize?: string; measurementUnit?: string };
  bookingDetails?: {
    landSize?: string;
    minLandSize?: string;
    maxLandSize?: string;
    measurementUnit?: string;
  };
}): string {
  const pd = payload.propertyDetails;
  const dd = payload.developmentDetails;
  const bd = payload.bookingDetails;
  const explicitSize = pd?.landSize || bd?.landSize || "";
  const minSize = pd?.minLandSize || dd?.minLandSize || bd?.minLandSize || "";
  const maxSize = pd?.maxLandSize || dd?.maxLandSize || bd?.maxLandSize || "";
  const size = explicitSize || (minSize && maxSize ? `${minSize} - ${maxSize}` : minSize || maxSize);
  const unitRaw = pd?.measurementUnit || dd?.measurementUnit || bd?.measurementUnit;
  const unit = formatPreferenceMeasurementUnitForEmail(unitRaw);
  if (!size) return "N/A";
  return [size, unit].filter(Boolean).join(" ");
}

function formatMoneyForEmail(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US");
}

export const preferenceMail = (mailData: any): string => {
  const {
    contactInfo,
    location,
    budget,
    preferenceMode,
    propertyDetails,
    developmentDetails,
    bookingDetails,
    features,
  } = mailData;

  const buyerName =
    contactInfo?.fullName || contactInfo?.contactPerson || "Valued Buyer";
  const propertyType =
    propertyDetails?.propertyType ||
    developmentDetails?.propertyType ||
    bookingDetails?.propertyType ||
    "N/A";

  // const locationString = location
  //   ? `${location.state || ""}${location.localGovernmentAreas?.length ? ", " + location.localGovernmentAreas.join(", ") : ""}${location.customLocation ? ", " + location.customLocation : ""}`
  //   : "N/A";
  
  const stateLocation = location?.state || "";

  const lgasLocation = location?.localGovernmentAreas?.length
    ? location.localGovernmentAreas.join(", ")
    : "";

  const customLocation = location?.customLocation || "N/A";

  const locationString = location
    ? [stateLocation, lgasLocation].filter(Boolean).join(", ")
    : "N/A";


  const priceRange = budget
    ? `${formatMoneyForEmail(budget.minPrice)} - ${formatMoneyForEmail(budget.maxPrice)} ${budget.currency || "NGN"}`
    : "N/A";

  const usageOption = preferenceMode ? preferenceMode : "N/A";

  const allFeatures = [
    ...(Array.isArray(features?.baseFeatures) ? features.baseFeatures : []),
    ...(Array.isArray(features?.premiumFeatures) ? features.premiumFeatures : []),
  ].filter(Boolean);
  const propertyFeatures = allFeatures.length ? allFeatures.join(", ") : "Not specified";

  const landSizeLine = buildPreferenceLandSizeEmailLine({
    propertyDetails,
    developmentDetails,
    bookingDetails,
  });

  return `
    <div style="font-family: Arial, sans-serif; background-color: white; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
      <p style="font-size: 16px;">Hi <strong>${buyerName}</strong>,</p>

      <p style="font-size: 16px;">Thank you for sharing your preferences with <strong>Khabi-Teq</strong>!<br>
      We'll match you with property briefs tailored to your needs.</p>

      <div style="background-color: #e9f3ee; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="font-weight: bold; margin: 0 0 10px;">Submitted Preference</p>
        <ul style="padding-left: 20px; margin: 0; font-size: 15px; list-style-type: disc;">
          <li style="margin-bottom: 8px;">Property Type: <strong>${propertyType}</strong></li>
          <li style="margin-bottom: 8px;">Location: <strong>${locationString}</strong></li>
          <li style="margin-bottom: 8px;">Custom Location: <strong>${customLocation}</strong></li>
          <li style="margin-bottom: 8px;">Price Range: <strong>${priceRange}</strong></li>
          <li style="margin-bottom: 8px;">Usage Options: <strong>${usageOption}</strong></li>
          <li style="margin-bottom: 8px;">Property Features: <strong>${propertyFeatures}</strong></li>
          <li style="margin-bottom: 0;">Land Size: <strong>${landSizeLine}</strong></li>
        </ul>
      </div>

      <p style="font-size: 16px;">Our team will get back to you with the necessary feedback.<br>
      Thank you for trusting <strong>Khabi-Teq</strong> with your property listing.</p>

      <p style="font-size: 16px;">Best regards,<br>
      <strong>The Khabi-Teq Team</strong></p>
    </div>
  `;
};


export const matchedPropertiesMail = (mailData: {
  contactInfo: {
    fullName?: string;
    contactPerson?: string;
  };
  preferenceSummary: {
    propertyType?: string;
    locationString?: string;
    priceRange?: string;
    usageOption?: string;
    propertyFeatures?: string;
    landSize?: string;
  };
  matchCount: number;
  matchLink: string;
}): string => {
  const {
    contactInfo,
    preferenceSummary,
    matchCount,
    matchLink,
  } = mailData;

  const buyerName =
    contactInfo?.fullName || contactInfo?.contactPerson || "Valued Buyer";

  const {
    propertyType = "N/A",
    locationString = "N/A",
    priceRange = "N/A",
    usageOption = "N/A",
    propertyFeatures = "Not specified",
    landSize = "N/A"
  } = preferenceSummary;

  return `
    <div style="font-family: Arial, sans-serif; background-color: #ffffff; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
      <p style="font-size: 16px;">Hi <strong>${buyerName}</strong>,</p>

      <p style="font-size: 16px;">
        Great news! We’ve found <strong>${matchCount}</strong> property match${matchCount === 1 ? "" : "es"} based on your submitted preferences on <strong>Khabi-Teq</strong>.
      </p>

      <div style="background-color: #f0f8f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="font-weight: bold; margin: 0 0 10px;">Your Submitted Preference</p>
        <ul style="padding-left: 20px; margin: 0; font-size: 15px; list-style-type: disc;">
          <li><strong>Property Type:</strong> ${propertyType}</li>
          <li><strong>Location:</strong> ${locationString}</li>
          <li><strong>Price Range:</strong> ${priceRange}</li>
          <li><strong>Usage Option:</strong> ${usageOption}</li>
          <li><strong>Property Features:</strong> ${propertyFeatures}</li>
          <li><strong>Land Size:</strong> ${landSize}</li>
        </ul>
      </div>

      <p style="font-size: 16px;">To view the matched properties, please click the button below:</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${matchLink}" style="background-color: #007B55; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-size: 16px;">
          View ${matchCount} Matched Propert${matchCount === 1 ? "y" : "ies"}
        </a>
      </div>

      <p style="font-size: 16px;">If these matches don’t meet your expectations, feel free to update your preferences or reach out for assistance.</p>

      <p style="font-size: 16px;">Best regards,<br>
      <strong>The Khabi-Teq Team</strong></p>
    </div>
  `;
};


export const rejectedPreferenceMail = (mailData: {
  buyerDetails?: {
    fullName?: string;
    email?: string;
    phoneNumber?: string;
  };
  contactInfo: {
    fullName?: string;
    contactPerson?: string;
  };
  preferenceSummary?: {
    propertyType?: string;
    locationString?: string;
    priceRange?: string;
    usageOption?: string;
    propertyFeatures?: string;
    landSize?: string;
  };
  rejectionReason?: string;
  updatePreferenceLink?: string;
}): string => {
  const {
    buyerDetails,
    contactInfo,
    preferenceSummary = {},
    rejectionReason,
    updatePreferenceLink,
  } = mailData;

  const buyerName =
    buyerDetails?.fullName ||
    contactInfo?.fullName ||
    contactInfo?.contactPerson ||
    "Valued Buyer";

  const {
    propertyType = "N/A",
    locationString = "N/A",
    priceRange = "N/A",
    usageOption = "N/A",
    propertyFeatures = "Not specified",
    landSize = "N/A",
  } = preferenceSummary;

  return `
    <div style="font-family: Arial, sans-serif; background-color: #ffffff; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
      <p style="font-size: 16px;">Hi <strong>${buyerName}</strong>,</p>

      <p style="font-size: 16px;">
        Thank you for submitting your property preference on <strong>Khabi-Teq</strong>.
        After reviewing your request, we’re unable to proceed with this preference at this time.
      </p>

      ${
        rejectionReason
          ? `
        <div style="background-color: #fdecea; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; font-size: 15px;">
            <strong>Reason:</strong> ${rejectionReason}
          </p>
        </div>
      `
          : ""
      }

      <div style="background-color:#f1f3f5;padding:12px;border-radius:5px;margin:20px 0;">
        <p style="margin:0;font-size:14px;">
          <strong>Email:</strong> ${buyerDetails?.email || "N/A"}<br/>
          <strong>Phone:</strong> ${buyerDetails?.phoneNumber || "N/A"}
        </p>
      </div>

      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="font-weight: bold; margin: 0 0 10px;">
          Submitted Preference Summary
        </p>
        <ul style="padding-left: 20px; margin: 0; font-size: 15px;">
          <li><strong>Property Type:</strong> ${propertyType}</li>
          <li><strong>Location:</strong> ${locationString}</li>
          <li><strong>Price Range:</strong> ${priceRange}</li>
          <li><strong>Usage Option:</strong> ${usageOption}</li>
          <li><strong>Property Features:</strong> ${propertyFeatures}</li>
          <li><strong>Land Size:</strong> ${landSize}</li>
        </ul>
      </div>

      <p style="font-size: 16px;">
        You may update your preferences to help us find better matches.
      </p>

      ${
        updatePreferenceLink
          ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${updatePreferenceLink}" style="background-color: #007B55; color: #ffffff; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-size: 16px;">
            Update Preference
          </a>
        </div>
      `
          : ""
      }

      <p style="font-size: 16px;">
        Best regards,<br/>
        <strong>The Khabi-Teq Team</strong>
      </p>
    </div>
  `;
};

/** Sent when automatic pairing finds no eligible listings for an otherwise valid preference. */
export const noMatchesPreferenceFeedbackMail = (mailData: {
  buyerName: string;
  submitPreferenceUrl?: string;
}): string => {
  const { buyerName, submitPreferenceUrl } = mailData;
  const browseOrSubmit = submitPreferenceUrl
    ? `<p style="font-size: 16px;">You can <strong>submit a new or updated preference</strong> (for example, a wider location or budget) using our form:</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${submitPreferenceUrl}" style="background-color: #007B55; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-size: 16px;">
          Submit a preference
        </a>
      </div>`
    : `<p style="font-size: 16px;">You can <strong>submit a new or updated preference</strong> anytime from our website (for example, a wider location or budget) to run another search.</p>`;

  return `
    <div style="font-family: Arial, sans-serif; background-color: #ffffff; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
      <p style="font-size: 16px;">Hi <strong>${buyerName}</strong>,</p>

      <p style="font-size: 16px;">
        Thank you again for sharing your preferences with <strong>Khabi-Teq</strong>.
      </p>

      <p style="font-size: 16px;">
        We searched our current <strong>approved, available listings</strong> against your criteria and <strong>did not find a match</strong> at this time.
      </p>

      ${browseOrSubmit}

      <p style="font-size: 16px;">
        Alternatively, you can <strong>wait</strong>: when new properties are listed that fit your preference, we will try to match them automatically and email you if listings are found.
      </p>

      <p style="font-size: 16px;">
        If you have questions, reply to our support channels or visit your dashboard.
      </p>

      <p style="font-size: 16px;">Best regards,<br/>
      <strong>The Khabi-Teq Team</strong></p>
    </div>
  `;
};
