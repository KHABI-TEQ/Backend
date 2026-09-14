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
    preferenceType,
    propertyDetails,
    developmentDetails,
    bookingDetails,
  } = mailData;

  const buyerName =
    contactInfo?.fullName || contactInfo?.contactPerson || "Valued Buyer";
  const firstName = String(buyerName).trim().split(/\s+/)[0] || "there";
  const propertyType =
    propertyDetails?.propertyType ||
    developmentDetails?.propertyType ||
    bookingDetails?.propertyType ||
    "";

  const stateLocation = location?.state || "";
  const lgasLocation = location?.localGovernmentAreas?.length
    ? location.localGovernmentAreas.join(", ")
    : "";
  const locationString = [stateLocation, lgasLocation].filter(Boolean).join(", ");

  const hasBudget =
    budget &&
    (Number.isFinite(Number(budget.minPrice)) || Number.isFinite(Number(budget.maxPrice)));
  const priceRange = hasBudget
    ? `${formatMoneyForEmail(budget.minPrice)} - ${formatMoneyForEmail(budget.maxPrice)} ${budget.currency || "NGN"}`
    : "";

  const preferenceKind = String(preferenceType || "").trim();

  const summaryItems = [
    preferenceKind && `Preference: <strong>${preferenceKind}</strong>`,
    propertyType && `Property Type: <strong>${propertyType}</strong>`,
    locationString && `Location: <strong>${locationString}</strong>`,
    priceRange && `Budget: <strong>${priceRange}</strong>`,
  ].filter(Boolean) as string[];

  const summaryHtml = summaryItems.length
    ? summaryItems
        .map(
          (item, index) =>
            `<li style="margin-bottom: ${index === summaryItems.length - 1 ? "0" : "8px"};">${item}</li>`,
        )
        .join("")
    : `<li style="margin-bottom: 0;">Details captured from your submission.</li>`;

  return `
    <div style="font-family: Arial, sans-serif; background-color: white; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
      <p style="font-size: 16px;">Hi <strong>${firstName}</strong>,</p>

      <p style="font-size: 16px;">Thank you for sharing your property preference with <strong>Khabiteq</strong>.</p>

      <p style="font-size: 16px;">We'll review your request through our professional network to identify relevant property opportunities.</p>

      <div style="background-color: #e9f3ee; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="font-weight: bold; margin: 0 0 10px;">Submitted Preference</p>
        <ul style="padding-left: 20px; margin: 0; font-size: 15px; list-style-type: disc;">
          ${summaryHtml}
        </ul>
      </div>

      <p style="font-size: 16px;">We'll keep you updated.</p>

      <p style="font-size: 16px;">Best regards,<br>
      <strong>The Khabiteq Team</strong></p>
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
  totalMatchCount?: number;
  revealedCount?: number;
  remainingCount?: number;
  nextBatchLink?: string;
}): string => {
  const {
    contactInfo,
    preferenceSummary,
    matchCount,
    matchLink,
    totalMatchCount,
    revealedCount,
    remainingCount,
    nextBatchLink,
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

  const total = totalMatchCount ?? matchCount;
  const shown = revealedCount ?? matchCount;
  const remaining = remainingCount ?? Math.max(0, total - shown);

  return `
    <div style="font-family: Arial, sans-serif; background-color: #ffffff; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
      <p style="font-size: 16px;">Hi <strong>${buyerName}</strong>,</p>

      <p style="font-size: 16px;">
        Great news! We’ve found <strong>${total}</strong> property match${total === 1 ? "" : "es"} based on your submitted preferences on <strong>Khabi-Teq</strong>.
        ${total > matchCount
          ? ` We’re sending them in small batches so they’re easier to review — <strong>${matchCount}</strong> ${matchCount === 1 ? "is" : "are"} ready now (${shown} of ${total} shown so far).`
          : ""}
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

      <p style="font-size: 16px;">To view this batch of matched properties, please click the button below:</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${matchLink}" style="background-color: #007B55; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-size: 16px;">
          View ${matchCount} Matched Propert${matchCount === 1 ? "y" : "ies"}
        </a>
      </div>

      ${
        nextBatchLink && remaining > 0
          ? `
      <p style="font-size: 16px;">If none of these feel right, you can pull the next batch without waiting for a new email:</p>
      <div style="text-align: center; margin: 20px 0;">
        <a href="${nextBatchLink}" style="background-color: #09391C; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-size: 16px;">
          Show next ${Math.min(5, remaining)} matches
        </a>
      </div>
      <p style="font-size: 13px; color: #5A5D63;">${remaining} more match${remaining === 1 ? "" : "es"} remaining.</p>
      `
          : `<p style="font-size: 16px;">If these matches don’t meet your expectations, feel free to update your preferences or reach out for assistance.</p>`
      }

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
  const firstName = String(mailData.buyerName || "").trim().split(/\s+/)[0] || "there";

  return `
    <div style="font-family: Arial, sans-serif; background-color: #ffffff; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
      <p style="font-size: 16px;">Hi <strong>${firstName}</strong>,</p>

      <p style="font-size: 16px;">Thank you for your patience while we reviewed your property preference.</p>

      <p style="font-size: 16px;">
        At this time, we have not identified a suitable match based on your current requirements. Your preference will now be reviewed through our professional network, where relevant agents can provide market insight based on factors such as availability, location and budget expectations.
      </p>

      <p style="font-size: 16px;">
        This feedback may help you better understand the market and, where necessary, refine your preference to improve your chances of finding a suitable property.
      </p>

      <p style="font-size: 16px;">We'll continue to keep you informed as relevant opportunities become available.</p>

      <p style="font-size: 16px;">Best regards,<br/>
      <strong>The Khabiteq Team</strong></p>
    </div>
  `;
};

/** Sent every 48 hours while an approved preference still has no matches. */
export const stillSearchingPreferenceMail = (mailData: {
  buyerName: string;
  preferenceSummary?: string;
}): string => {
  const { buyerName, preferenceSummary } = mailData;
  const summaryBlock = preferenceSummary
    ? `<p style="font-size: 16px;">We are still matching this preference:</p>
      <p style="font-size: 16px; background-color: #F5F7F6; padding: 12px 16px; border-radius: 8px;">
        ${preferenceSummary}
      </p>`
    : "";

  return `
    <div style="font-family: Arial, sans-serif; background-color: #ffffff; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
      <p style="font-size: 16px;">Hi <strong>${buyerName}</strong>,</p>

      <p style="font-size: 16px;">
        We are <strong>still actively searching</strong> for a listing that matches your submitted preference.
      </p>

      ${summaryBlock}

      <p style="font-size: 16px;">
        As soon as an approved property fits your criteria, we will send you the matches (a few at a time) by email and in the app.
      </p>

      <p style="font-size: 16px;">
        No action is needed from you. We will check in again in 48 hours if we have not found a match yet.
      </p>

      <p style="font-size: 16px;">Best regards,<br/>
      <strong>The Khabi-Teq Team</strong></p>
    </div>
  `;
};

/** Practitioner: one or more of their listings matched a submitted buyer preference. */
export const listingMatchedPreferenceMail = (mailData: {
  practitionerName: string;
  properties: { title: string; propertyType?: string }[];
  preferenceSummary: {
    propertyType?: string;
    locationString?: string;
    priceRange?: string;
  };
  dashboardLink: string;
}): string => {
  const {
    practitionerName,
    properties,
    preferenceSummary,
    dashboardLink,
  } = mailData;
  const count = properties.length;
  const listingLabel = count === 1 ? "listing" : "listings";
  const rows = properties
    .map((p) => {
      const type = p.propertyType ? ` (${p.propertyType})` : "";
      return `<li style="margin-bottom: 8px;"><strong>${p.title}</strong>${type}</li>`;
    })
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; background-color: #ffffff; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
      <p style="font-size: 16px;">Hi <strong>${practitionerName}</strong>,</p>

      <p style="font-size: 16px;">
        Good news — <strong>${count}</strong> of your ${listingLabel} automatically matched a buyer preference on <strong>Khabi-Teq</strong>.
      </p>

      <div style="background-color: #f0f8f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="font-weight: bold; margin: 0 0 10px;">Matched listing${count === 1 ? "" : "s"}</p>
        <ul style="padding-left: 20px; margin: 0; font-size: 15px; list-style-type: disc;">
          ${rows}
        </ul>
      </div>

      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="font-weight: bold; margin: 0 0 10px;">Buyer preference (summary)</p>
        <ul style="padding-left: 20px; margin: 0; font-size: 15px; list-style-type: disc;">
          <li><strong>Looking to:</strong> ${preferenceSummary.propertyType || "N/A"}</li>
          <li><strong>Location:</strong> ${preferenceSummary.locationString || "N/A"}</li>
          <li><strong>Budget:</strong> ${preferenceSummary.priceRange || "N/A"}</li>
        </ul>
      </div>

      <p style="font-size: 16px;">
        The buyer has been notified. Open your listing in the app or dashboard to follow up when they request an inspection.
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${dashboardLink}" style="background-color: #007B55; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-size: 16px;">
          Open dashboard
        </a>
      </div>

      <p style="font-size: 13px; color: #5A5D63;">Prefer the app? Open <strong>Listings</strong> in Khabi-Teq Practitioners.</p>

      <p style="font-size: 16px;">Best regards,<br>
      <strong>The Khabi-Teq Team</strong></p>
    </div>
  `;
};
