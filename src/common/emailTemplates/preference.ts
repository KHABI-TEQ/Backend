export const preferenceMail = (mailData: any): string => {
  const {
    contactInfo,
    location,
    budget,
    preferenceType,
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

  const locationString = location
    ? `${location.state || ""}${location.localGovernmentAreas?.length ? ", " + location.localGovernmentAreas.join(", ") : ""}${location.customLocation ? ", " + location.customLocation : ""}`
    : "N/A";

  const priceRange = budget
    ? `${budget.minPrice || 0} - ${budget.maxPrice || 0} ${budget.currency || "NGN"}`
    : "N/A";

  const usageOption = preferenceMode ? preferenceMode : "N/A";

  const propertyFeatures = features?.baseFeatures?.length
    ? features.baseFeatures.join(", ")
    : "Not specified";

  const landSize =
    propertyDetails?.landSize ||
    developmentDetails?.minLandSize ||
    bookingDetails?.landSize ||
    "N/A";

  return `
    <div style="font-family: Arial, sans-serif; background-color: white; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
      <p style="font-size: 16px;">Hi <strong>${buyerName}</strong>,</p>

      <p style="font-size: 16px;">Thank you for sharing your preferences with <strong>Khabi-Teq Realty</strong>!<br>
      We'll match you with property briefs tailored to your needs.</p>

      <div style="background-color: #e9f3ee; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="font-weight: bold; margin: 0 0 10px;">Submitted reference</p>
        <ul style="padding-left: 20px; margin: 0; font-size: 15px; list-style-type: disc;">
          <li style="margin-bottom: 8px;">Property Type: <strong>${propertyType}</strong></li>
          <li style="margin-bottom: 8px;">Location: <strong>${locationString}</strong></li>
          <li style="margin-bottom: 8px;">Price Range: <strong>${priceRange}</strong></li>
          <li style="margin-bottom: 8px;">Usage Options: <strong>${usageOption}</strong></li>
          <li style="margin-bottom: 8px;">Property Features: <strong>${propertyFeatures}</strong></li>
          <li style="margin-bottom: 0;">Land Size: <strong>${landSize}</strong></li>
        </ul>
      </div>

      <p style="font-size: 16px;">Our team will get back to you with the necessary feedback.<br>
      Thank you for trusting <strong>Khabi-Teq Realty</strong> with your property listing.</p>

      <p style="font-size: 16px;">Best regards,<br>
      <strong>The Khabi-Teq Realty Team</strong></p>
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
        Great news! We’ve found <strong>${matchCount}</strong> property match${matchCount === 1 ? "" : "es"} based on your submitted preferences on <strong>Khabi-Teq Realty</strong>.
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
      <strong>The Khabi-Teq Realty Team</strong></p>
    </div>
  `;
};

