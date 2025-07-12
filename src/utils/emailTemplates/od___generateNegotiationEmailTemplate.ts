// Utility function for formatting prices
function formatPrice(price: number | string): string {
  if (typeof price === "string") {
    price = parseFloat(price);
  }
  if (isNaN(price)) {
    return "N/A";
  }
  return `₦${price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Specific email templates for inspection actions
function NegotiationAcceptedTemplate(
  buyerName: string,
  propertyData: any,
  isInitiator: boolean = false,
): string {
  const {
    location,
    price,
    negotiationPrice,
    propertyType,
    inspectionDateStatus,
    inspectionDateTime,
  } = propertyData;

  const inspectionDate = inspectionDateTime?.newDateTime?.newDate;
  const inspectionTime = inspectionDateTime?.newDateTime?.newTime;
  const dateTimeChanged = inspectionDateTime?.dateTimeChanged;

  let introMessage = "";
  let confirmedDateTimeHtml = "";
  let inspectionDetailsBgColor = "#FAFAFA";

  if (isInitiator) {
    introMessage = `You have successfully <span style="color: #1AAD1F;">accepted</span> the negotiation offer for the property at ${location}.`;
  } else {
    if (dateTimeChanged) {
      introMessage = `Great news! The seller has <span style="color: #1AAD1F;">accepted</span> your negotiation offer and <strong style="color: #1AAD1F;">updated the inspection schedule</strong> for the property at ${location}.`;
      confirmedDateTimeHtml = `
        <ul style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p><strong>Updated Inspection Schedule:</strong></p>
          <li><strong>Original Date:</strong> ${inspectionDateTime?.oldDateTime?.newDate || "N/A"}</li>
          <li><strong>Original Time:</strong> ${inspectionDateTime?.oldDateTime?.oldTime || "N/A"}</li>
          <li style="margin-top: 10px; color: #1AAD1F;"><strong>New Confirmed Date:</strong> ${inspectionDate || "N/A"}</li>
          <li style="color: #1AAD1F;"><strong>New Confirmed Time:</strong> ${inspectionTime || "N/A"}</li>
        </ul>`;
    } else {
      introMessage = `Great news! The seller has <span style="color: #1AAD1F;">accepted</span> your negotiation offer and confirmed the inspection for the property at ${location}.`;
      confirmedDateTimeHtml = `
        <ul style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p><strong>Confirmed Inspection Details:</strong></p>
          <li><strong>Date:</strong> ${inspectionDate || "N/A"} <span style="color: #34A853;">(Unchanged from original request)</span></li>
          <li><strong>Time:</strong> ${inspectionTime || "N/A"} <span style="color: #34A853;">(Unchanged from original request)</span></li>
        </ul>`;
    }
  }

  // For initiators, show different confirmation view
  if (isInitiator) {
    if (dateTimeChanged) {
      confirmedDateTimeHtml = `
        <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p style="color: #34A853;"><strong>Offer Accepted:</strong></p>
          <li><strong>Buyer Price:</strong> ${formatPrice(negotiationPrice) || "N/A"}</li>
        </ul>
        <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px;">
          <p><strong>Updated Inspection Details:</strong></p>
          <li><strong>Original Date:</strong> ${inspectionDateTime?.oldDateTime?.newDate || "N/A"}</li>
          <li><strong>Original Time:</strong> ${inspectionDateTime?.oldDateTime?.oldTime || "N/A"}</li>
          <li style="margin-top: 10px; color: #1976D2;"><strong>New Date:</strong> ${inspectionDate || "N/A"}</li>
          <li style="color: #1976D2;"><strong>New Time:</strong> ${inspectionTime || "N/A"}</li>
        </ul>`;
    } else {
      confirmedDateTimeHtml = `
        <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p style="color: #34A853;"><strong>Offer Accepted:</strong></p>
          <li><strong>Buyer Price:</strong> ${formatPrice(negotiationPrice) || "N/A"}</li>
        </ul>
        <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px;">
          <p><strong>Inspection Details:</strong></p>
          <li><strong>Date:</strong> ${inspectionDate || "N/A"} <span style="color: #34A853;">(Confirmed by seller)</span></li>
          <li><strong>Time:</strong> ${inspectionTime || "N/A"} <span style="color: #34A853;">(Confirmed by seller)</span></li>
        </ul>`;
    }
  }

  return `
    <p>Dear ${buyerName},</p>
    <p style="margin-top: 10px;">${introMessage}</p>

    ${!isInitiator ? `
    <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p><strong>Offer Details:</strong></p>
        <li><strong>Accepted Price:</strong> ${formatPrice(negotiationPrice) || "N/A"}</li>
    </ul>
    ` : ''}

    ${confirmedDateTimeHtml}

    <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px;">
      <p><strong>Property Details:</strong></p>
      <li><strong>Property Type:</strong> ${propertyType || "N/A"}</li>
      <li><strong>Location:</strong> ${location || "N/A"}</li>
      <li><strong>Original Price:</strong> ${formatPrice(price) || "N/A"}</li>
    </ul>

    ${!isInitiator ? `
    <p style="margin-top: 15px;">You'll receive a reminder before the inspection. If you have any questions, feel free to reach out.</p>
    <p style="margin-top: 15px;">We look forward to seeing you then. If you need to reschedule, please let us know.</p>

    <div style="margin-top: 20px;">
      <a href="${propertyData.buyerResponseLink}" style="display: inline-block; width: 162px; height: 40px; background-color: #1A7F64; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-right: 10px;">
        View Details
      </a>
      <a href="${propertyData.buyerResponseLink}" style="display: inline-block; width: 162px; height: 40px; background-color: #6C757D; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold;">
        Reschedule
      </a>
    </div>
    ` : `
    <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>
    `}`;
}

function CounterBuyerTemplate(buyerName: string, propertyData: any, isInitiator: boolean = false): string {
  const {
    sellerCounterOffer,
    propertyType,
    location,
    price,
    inspectionDateTime,
  } = propertyData;

  const inspectionDate = inspectionDateTime?.newDateTime?.newDate;
  const inspectionTime = inspectionDateTime?.newDateTime?.newTime;
  const dateTimeChanged = inspectionDateTime?.dateTimeChanged;

  let introMessage = "";
  let inspectionDetailsHtml = "";
  let inspectionDetailsBgColor = "#FAFAFA";

  if (isInitiator) {
    introMessage = `You have successfully <span style="color: #1AAD1F;">countered</span> the buyer's offer for the property at ${location}.`;
  } else {
    if (dateTimeChanged) {
      introMessage = `The seller has reviewed your offer and responded with a <span style="color: #1976D2;">counter-offer</span>. They have also <strong style="color: #34A853;">proposed new inspection date/time details</strong>.`;
      inspectionDetailsHtml = `
        <ul style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p style="color: #34A853;"><strong>Updated Inspection Schedule:</strong></p>
          <li><strong>Original Date:</strong> ${inspectionDateTime?.oldDateTime?.newDate || "N/A"}</li>
          <li><strong>Original Time:</strong> ${inspectionDateTime?.oldDateTime?.oldTime || "N/A"}</li>
          <li style="margin-top: 10px; color: #1976D2;"><strong>New Proposed Date:</strong> ${inspectionDate || "N/A"}</li>
          <li style="color: #1976D2;"><strong>New Proposed Time:</strong> ${inspectionTime || "N/A"}</li>
        </ul>`;
    } else {
      introMessage = `The seller has reviewed your offer and responded with a <span style="color: #1976D2;">counter-offer</span>. The inspection date and time has also been approved.`;
      inspectionDetailsHtml = `
        <ul style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p style="color: #34A853;"><strong>Inspection Details:</strong></p>
          <li><strong>Date:</strong> ${inspectionDate || "N/A"} <span style="color: #34A853;">(Confirmed by seller)</span></li>
          <li><strong>Time:</strong> ${inspectionTime || "N/A"} <span style="color: #34A853;">(Confirmed by seller)</span></li>
        </ul>`;
    }
  }

  // For initiators, show different confirmation view
  if (isInitiator) {
    if (dateTimeChanged) {
      inspectionDetailsHtml = `
        <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p><strong>Negotiation:</strong></p>
          <li><strong>Buyer Price:</strong> ${formatPrice(propertyData.negotiationPrice) || "N/A"}</li>
          <li><strong>Your Counter Offer:</strong> ${formatPrice(sellerCounterOffer) || "N/A"}</li>
        </ul>
        <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p><strong>Updated Inspection Details:</strong></p>
          <li><strong>Original Date:</strong> ${inspectionDateTime?.oldDateTime?.newDate || "N/A"}</li>
          <li><strong>Original Time:</strong> ${inspectionDateTime?.oldDateTime?.oldTime || "N/A"}</li>
          <li style="margin-top: 10px; color: #1976D2;"><strong>New Date:</strong> ${inspectionDate || "N/A"}</li>
          <li style="color: #1976D2;"><strong>New Time:</strong> ${inspectionTime || "N/A"}</li>
        </ul>`;
    } else {
      inspectionDetailsHtml = `
        <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p><strong>Negotiation:</strong></p>
          <li><strong>Buyer Price:</strong> ${formatPrice(propertyData.negotiationPrice) || "N/A"}</li>
          <li><strong>Your Counter Offer:</strong> ${formatPrice(sellerCounterOffer) || "N/A"}</li>
        </ul>
        <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p><strong>Inspection Details:</strong></p>
          <li><strong>Date:</strong> ${inspectionDate || "N/A"} <span style="color: #34A853;">(Confirmed)</span></li>
          <li><strong>Time:</strong> ${inspectionTime || "N/A"} <span style="color: #34A853;">(Confirmed)</span></li>
        </ul>`;
    }
  }

  return `
    <p>Hi ${buyerName},</p>
    <p style="margin-top: 10px;">${introMessage}</p>
    
    ${!isInitiator ? `
    <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
      <p style="color: #34A853;"><strong>Offer Details:</strong></p>
      <li><strong>Seller's Counter-Offer:</strong> ${formatPrice(sellerCounterOffer) || "N/A"}</li>
    </ul>
    ` : ''}

    <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px;">
      <p><strong>Property Details:</strong></p>
      <li><strong>Property Type:</strong> ${propertyType || "N/A"}</li>
      <li><strong>Location:</strong> ${location || "N/A"}</li>
      <li><strong>Original Price:</strong> ${formatPrice(price) || "N/A"}</li>
    </ul>

    ${inspectionDetailsHtml}

    ${!isInitiator ? `
    <p style="margin-top: 15px;">Please click below to accept or decline the Offer.</p>

    <div style="margin-top: 20px;">
      <a href="${propertyData.buyerResponseLink}" style="display: inline-block; width: 120px; height: 40px; background-color: #1A7F64; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-right: 10px;">
        Accept Offer
      </a>
      <a href="${propertyData.buyerResponseLink}" style="display: inline-block; width: 120px; height: 40px; background-color: #DC3545; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-right: 10px;">
        Reject Offer
      </a>
      <a href="${propertyData.buyerResponseLink}" style="display: inline-block; width: 120px; height: 40px; background-color: #FFC107; color: #000; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold;">
        Counter Offer
      </a>
    </div>

    <p style="margin-top: 15px;">Thanks for your flexibility!</p>
    ` : `
    <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>
    `}`;
}

function InspectionAcceptedTemplate(
  buyerName: string,
  propertyData: any,
  isInitiator: boolean = false,
): string {
  const {
    location,
    price,
    propertyType,
    inspectionDateTime,
  } = propertyData;

  const inspectionDate = inspectionDateTime?.newDateTime?.newDate;
  const inspectionTime = inspectionDateTime?.newDateTime?.newTime;
  const dateTimeChanged = inspectionDateTime?.dateTimeChanged;

  let introMessage = "";
  let confirmedDateTimeHtml = "";
  let inspectionDetailsBgColor = "#EEF7FF";

  if (isInitiator) {
    introMessage = `You have successfully <span style="color: #1AAD1F;">accepted</span> the inspection request for ${location}.`;
  } else {
    if (dateTimeChanged) {
      introMessage = `Good news! The seller has <span style="color: #1AAD1F;">accepted</span> your inspection request for ${location}. The originally requested date was unavailable, and a <strong style="color: #1AAD1F;">new date and time have been confirmed</strong>.`;
      confirmedDateTimeHtml = `
        <ul style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p><strong>Updated Inspection Schedule:</strong></p>
          <li><strong>Original Date:</strong> ${inspectionDateTime?.oldDateTime?.newDate || "N/A"}</li>
          <li><strong>Original Time:</strong> ${inspectionDateTime?.oldDateTime?.oldTime || "N/A"}</li>
          <li style="margin-top: 10px; color: #1AAD1F;"><strong>New Confirmed Date:</strong> ${inspectionDate || "N/A"}</li>
          <li style="color: #1AAD1F;"><strong>New Confirmed Time:</strong> ${inspectionTime || "N/A"}</li>
        </ul>`;
    } else {
      introMessage = `Good news! The seller has <span style="color: #1AAD1F;">accepted</span> your inspection request for ${location}.`;
      confirmedDateTimeHtml = `
        <ul style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p><strong>Confirmed Date & Time:</strong></p>
          <li><strong>Date:</strong> ${inspectionDate || "N/A"} <span style="color: #34A853;">(Unchanged from original request)</span></li>
          <li><strong>Time:</strong> ${inspectionTime || "N/A"} <span style="color: #34A853;">(Unchanged from original request)</span></li>
        </ul>`;
    }
  }

  // For initiators, show different confirmation view
  if (isInitiator) {
    if (dateTimeChanged) {
      confirmedDateTimeHtml = `
        <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p><strong>Updated Inspection Details:</strong></p>
          <li><strong>Original Date:</strong> ${inspectionDateTime?.oldDateTime?.newDate || "N/A"}</li>
          <li><strong>Original Time:</strong> ${inspectionDateTime?.oldDateTime?.oldTime || "N/A"}</li>
          <li style="margin-top: 10px; color: #1976D2;"><strong>New Date:</strong> ${inspectionDate || "N/A"}</li>
          <li style="color: #1976D2;"><strong>New Time:</strong> ${inspectionTime || "N/A"}</li>
        </ul>`;
    } else {
      confirmedDateTimeHtml = `
        <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p><strong>Inspection Details:</strong></p>
          <li><strong>Date:</strong> ${inspectionDate || "N/A"} <span style="color: #34A853;">(Confirmed)</span></li>
          <li><strong>Time:</strong> ${inspectionTime || "N/A"} <span style="color: #34A853;">(Confirmed)</span></li>
        </ul>`;
    }
  }

  return `
    <p>Hi ${buyerName},</p>
    <p style="margin-top: 10px;">${introMessage}</p>

    ${confirmedDateTimeHtml}

    <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px;">
      <p><strong>Property Details:</strong></p>
      <li><strong>Property Type:</strong> ${propertyType || "N/A"}</li>
      <li><strong>Location:</strong> ${location || "N/A"}</li>
      <li><strong>Price:</strong> ${formatPrice(price) || "N/A"}</li>
    </ul>

    ${!isInitiator ? `
    <p style="margin-top: 15px;">You'll receive a reminder before the inspection. If you have any questions, feel free to reach out.</p>
    <p style="margin-top: 15px;">We look forward to seeing you then. If you need to reschedule, please let us know.</p>

    <div style="margin-top: 20px;">
      <a href="${propertyData.buyerResponseLink}" style="display: inline-block; width: 162px; height: 40px; background-color: #1A7F64; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-right: 10px;">
        View Details
      </a>
      <a href="${propertyData.buyerResponseLink}" style="display: inline-block; width: 162px; height: 40px; background-color: #6C757D; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold;">
        Reschedule
      </a>
    </div>
    ` : `
    <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>
    `}`;
}

// Enhanced LOI Templates with initiator awareness
function LOINegotiationAcceptedTemplate(
  buyerName: string,
  propertyData: any,
  isInitiator: boolean = false,
): string {
  const dateTimeChanged = propertyData.inspectionDateTime?.dateTimeChanged;
  const inspectionDate = propertyData.inspectionDateTime?.newDateTime?.newDate;
  const inspectionTime = propertyData.inspectionDateTime?.newDateTime?.newTime;

  if (isInitiator) {
    if (dateTimeChanged) {
      return `
        <p>Dear ${buyerName},</p>
        <p style="margin-top: 10px;">You have successfully <span style="color: #1AAD1F;">accepted</span> the buyer's Letter of Intent (LOI) for the property at ${propertyData.location}.</p>

        <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p style="color: #34A853;"><strong>LOI Accepted:</strong></p>
          <li><strong>LOI Status:</strong> Accepted</li>
        </ul>

        <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px;">
          <p><strong>Updated Inspection Details:</strong></p>
          <li><strong>Original Date:</strong> ${propertyData.inspectionDateTime?.oldDateTime?.newDate || "N/A"}</li>
          <li><strong>Original Time:</strong> ${propertyData.inspectionDateTime?.oldDateTime?.oldTime || "N/A"}</li>
          <li style="margin-top: 10px; color: #1976D2;"><strong>New Date:</strong> ${inspectionDate}</li>
          <li style="color: #1976D2;"><strong>New Time:</strong> ${inspectionTime}</li>
        </ul>

        <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px;">
          <p><strong>Property Details:</strong></p>
          <li><strong>Property Type:</strong> ${propertyData.propertyType}</li>
          <li><strong>Location:</strong> ${propertyData.location}</li>
        </ul>

        <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`;
    } else {
      return `
        <p>Dear ${buyerName},</p>
        <p style="margin-top: 10px;">You have successfully <span style="color: #1AAD1F;">accepted</span> the buyer's Letter of Intent (LOI) for the property at ${propertyData.location}.</p>

        <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p style="color: #34A853;"><strong>LOI Accepted:</strong></p>
          <li><strong>Inspection Date:</strong> ${inspectionDate} ${inspectionTime} <span style="color: #34A853;">(Confirmed)</span></li>
          <li><strong>LOI Status:</strong> Accepted</li>
        </ul>

        <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px;">
          <p><strong>Property Details:</strong></p>
          <li><strong>Property Type:</strong> ${propertyData.propertyType}</li>
          <li><strong>Location:</strong> ${propertyData.location}</li>
        </ul>

        <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`;
    }
  }

  if (dateTimeChanged) {
    return `
      <p>Dear ${buyerName},</p>
      <p style="margin-top: 10px;">Great news! The seller has <span style="color: #1AAD1F;">accepted</span> your Letter of Intent (LOI) and <strong style="color: #1AAD1F;">updated the inspection schedule</strong> for the property at ${propertyData.location}.</p>

      <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p><strong>Updated Inspection Schedule:</strong></p>
        <li><strong>Original Date:</strong> ${propertyData.inspectionDateTime?.oldDateTime?.newDate || "N/A"}</li>
        <li><strong>Original Time:</strong> ${propertyData.inspectionDateTime?.oldDateTime?.oldTime || "N/A"}</li>
        <li style="margin-top: 10px; color: #1AAD1F;"><strong>New Confirmed Date:</strong> ${inspectionDate}</li>
        <li style="color: #1AAD1F;"><strong>New Confirmed Time:</strong> ${inspectionTime}</li>
        <li><strong>LOI Offer:</strong> Accepted</li>
      </ul>

      <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px;">
        <p><strong>Property Details:</strong></p>
        <li><strong>Property Type:</strong> ${propertyData.propertyType}</li>
        <li><strong>Location:</strong> ${propertyData.location}</li>
      </ul>

      <p style="margin-top: 15px;">Our team will follow up with you shortly to ensure a smooth inspection process.<br/><br/>Thank you for using Khabi-Teq Realty. We're committed to helping you close your deal faster.</p>
      <p style="margin-top: 15px;">You'll receive a reminder before the inspection. If you have any questions, feel free to reach out.</p>
      <p style="margin-top: 15px;">We look forward to seeing you then. If you need to reschedule, please let us know.</p>

      <div style="margin-top: 20px;">
        <a href="${propertyData.buyerResponseLink}" style="display: inline-block; width: 162px; height: 40px; background-color: #1A7F64; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-right: 10px;">
          View Details
        </a>
        <a href="${propertyData.buyerResponseLink}" style="display: inline-block; width: 162px; height: 40px; background-color: #6C757D; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold;">
          Reschedule
        </a>
      </div>`;
  }

  return `
    <p>Dear ${buyerName},</p>
    <p style="margin-top: 10px;">Great news! The seller has <span style="color: #1AAD1F;">accepted</span> your Letter of Intent (LOI) for the property at ${propertyData.location}.</p>

    <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
      <p><strong>Please find the details:</strong></p>
      <li><strong>Inspection Date:</strong> ${inspectionDate} ${inspectionTime} <span style="color: #34A853;">(Unchanged from original request)</span></li>
      <li><strong>LOI Offer:</strong> Accepted</li>
    </ul>

    <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px;">
      <p><strong>Property Details:</strong></p>
      <li><strong>Property Type:</strong> ${propertyData.propertyType}</li>
      <li><strong>Location:</strong> ${propertyData.location}</li>
    </ul>

    <p style="margin-top: 15px;">Our team will follow up with you shortly to ensure a smooth inspection process.<br/><br/>Thank you for using Khabi-Teq Realty. We're committed to helping you close your deal faster.</p>
    <p style="margin-top: 15px;">You'll receive a reminder before the inspection. If you have any questions, feel free to reach out.</p>
    <p style="margin-top: 15px;">We look forward to seeing you then. If you need to reschedule, please let us know.</p>

    <a href="${propertyData.buyerResponseLink}" style="display: inline-block; width: 162px; height: 40px; background-color: #1A7F64; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold; gap: 8px; padding: 8px 16px;">
      Reschedule Inspection
    </a>`;
}

// New template for LOI Request Changes
function LOIRequestChangesTemplate(
  recipientName: string,
  propertyData: any,
  isInitiator: boolean = false,
): string {
  const {
    location,
    reason,
    inspectionDateTime,
  } = propertyData;

  const dateTimeChanged = inspectionDateTime?.dateTimeChanged;
  const inspectionDate = inspectionDateTime?.newDateTime?.newDate;
  const inspectionTime = inspectionDateTime?.newDateTime?.newTime;

  if (isInitiator) {
    // Seller's confirmation email (they initiated the request)
    if (dateTimeChanged) {
      return `
        <p>Hi ${recipientName},</p>
        <p style="margin-top: 10px;">You have successfully <span style="color: #1976D2;">requested changes</span> to the buyer's LOI document and <strong style="color: #1976D2;">updated the inspection schedule</strong> for the property at ${location}.</p>

        <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p><strong>Request Details:</strong></p>
          <li><strong>Reason for Changes:</strong> ${reason || "N/A"}</li>
        </ul>

        <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px;">
          <p><strong>Updated Inspection Details:</strong></p>
          <li><strong>Original Date:</strong> ${inspectionDateTime?.oldDateTime?.newDate || "N/A"}</li>
          <li><strong>Original Time:</strong> ${inspectionDateTime?.oldDateTime?.oldTime || "N/A"}</li>
          <li style="margin-top: 10px; color: #1976D2;"><strong>New Date:</strong> ${inspectionDate || "N/A"}</li>
          <li style="color: #1976D2;"><strong>New Time:</strong> ${inspectionTime || "N/A"}</li>
        </ul>

        <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px;">
          <p><strong>Property Details:</strong></p>
          <li><strong>Property Type:</strong> ${propertyData.propertyType || "N/A"}</li>
          <li><strong>Location:</strong> ${location || "N/A"}</li>
        </ul>

        <p style="margin-top: 15px;">The buyer will be notified of your requested changes and can resubmit their LOI document.</p>
        <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`;
    } else {
      return `
        <p>Hi ${recipientName},</p>
        <p style="margin-top: 10px;">You have successfully <span style="color: #1976D2;">requested changes</span> to the buyer's LOI document for the property at ${location}.</p>

        <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p><strong>Request Details:</strong></p>
          <li><strong>Reason for Changes:</strong> ${reason || "N/A"}</li>
          <li><strong>Inspection Date:</strong> ${inspectionDate || "N/A"} <span style="color: #34A853;">(Confirmed)</span></li>
          <li><strong>Inspection Time:</strong> ${inspectionTime || "N/A"} <span style="color: #34A853;">(Confirmed)</span></li>
        </ul>

        <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px;">
          <p><strong>Property Details:</strong></p>
          <li><strong>Property Type:</strong> ${propertyData.propertyType || "N/A"}</li>
          <li><strong>Location:</strong> ${location || "N/A"}</li>
        </ul>

        <p style="margin-top: 15px;">The buyer will be notified of your requested changes and can resubmit their LOI document.</p>
        <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`;
    }
  } else {
    // Buyer's notification email (they need to take action)
    if (dateTimeChanged) {
      return `
        <p>Hi ${recipientName},</p>
        <p style="margin-top: 10px;">The seller has <span style="color: #1976D2;">requested changes</span> to your LOI document and <strong style="color: #1976D2;">updated the inspection schedule</strong> for the property at ${location}.</p>

        <ul style="background-color: #FFF3CD; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p style="color: #856404;"><strong>Requested Changes:</strong></p>
          <li><strong>Suggested Changes:</strong> ${reason || "N/A"}</li>
        </ul>

        <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px;">
          <p><strong>Updated Inspection Schedule:</strong></p>
          <li><strong>Original Date:</strong> ${inspectionDateTime?.oldDateTime?.newDate || "N/A"}</li>
          <li><strong>Original Time:</strong> ${inspectionDateTime?.oldDateTime?.oldTime || "N/A"}</li>
          <li style="margin-top: 10px; color: #1976D2;"><strong>New Date:</strong> ${inspectionDate || "N/A"}</li>
          <li style="color: #1976D2;"><strong>New Time:</strong> ${inspectionTime || "N/A"}</li>
        </ul>

        <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px;">
          <p><strong>Property Details:</strong></p>
          <li><strong>Property Type:</strong> ${propertyData.propertyType || "N/A"}</li>
          <li><strong>Location:</strong> ${location || "N/A"}</li>
        </ul>

        <p style="margin-top: 15px;">Please review the requested changes and update your LOI document accordingly.</p>

        <div style="margin-top: 20px;">
          <a href="${propertyData.buyerResponseLink}" style="display: inline-block; width: 180px; height: 40px; background-color: #1A7F64; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-right: 10px;">
            Resubmit LOI Document
          </a>
          <a href="${propertyData.buyerResponseLink}" style="display: inline-block; width: 140px; height: 40px; background-color: #6C757D; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            View Details
          </a>
        </div>

        <p style="margin-top: 15px;">If you have any questions about the requested changes, feel free to reach out.</p>`;
    } else {
      return `
        <p>Hi ${recipientName},</p>
        <p style="margin-top: 10px;">The seller has <span style="color: #1976D2;">requested changes</span> to your LOI document for the property at ${location}.</p>

        <ul style="background-color: #FFF3CD; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p style="color: #856404;"><strong>Requested Changes:</strong></p>
          <li><strong>Suggested Changes:</strong> ${reason || "N/A"}</li>
          <li><strong>Inspection Date:</strong> ${inspectionDate || "N/A"} <span style="color: #34A853;">(Unchanged from original request)</span></li>
          <li><strong>Inspection Time:</strong> ${inspectionTime || "N/A"} <span style="color: #34A853;">(Unchanged from original request)</span></li>
        </ul>

        <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px;">
          <p><strong>Property Details:</strong></p>
          <li><strong>Property Type:</strong> ${propertyData.propertyType || "N/A"}</li>
          <li><strong>Location:</strong> ${location || "N/A"}</li>
        </ul>

        <p style="margin-top: 15px;">Please review the requested changes and update your LOI document accordingly.</p>

        <div style="margin-top: 20px;">
          <a href="${propertyData.buyerResponseLink}" style="display: inline-block; width: 180px; height: 40px; background-color: #1A7F64; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-right: 10px;">
            Update LOI Document
          </a>
          <a href="${propertyData.buyerResponseLink}" style="display: inline-block; width: 140px; height: 40px; background-color: #6C757D; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            View Details
          </a>
        </div>

        <p style="margin-top: 15px;">If you have any questions about the requested changes, feel free to reach out.</p>`;
    }
  }
}

// Main interface
interface EmailTemplateParams {
  userType: "seller" | "buyer";
  action: "accept" | "reject" | "counter" | "request_changes";
  buyerName: string;
  sellerName: string;
  recipientType: "buyer" | "seller";
  payload: any;
  isLOI: boolean;
  isInitiator?: boolean; // New parameter to identify if recipient is the action initiator
}

interface EmailTemplate {
  html: string;
  text: string;
}

export function generateNegotiationEmailTemplate(
  params: EmailTemplateParams,
): EmailTemplate {
  const {
    userType,
    action,
    buyerName,
    sellerName,
    recipientType,
    payload,
    isLOI,
    isInitiator = false,
  } = params;

  const recipientName = recipientType === "buyer" ? buyerName : sellerName;
  let htmlContent = "";

  // Generate specific email content based on action and recipient
  if (isLOI) {
    // LOI-specific templates
    switch (action) {
      case "accept":
        if (recipientType === "buyer") {
          htmlContent = LOINegotiationAcceptedTemplate(buyerName, payload, isInitiator);
        } else {
          if (isInitiator) {
            const dateTimeChanged = payload.inspectionDateTime?.dateTimeChanged;
            if (dateTimeChanged) {
              htmlContent = `
                <p>Hi ${sellerName},</p>
                <p style="margin-top: 10px;">You've successfully <span style="color: #1AAD1F;">accepted</span> the buyer's LOI and <strong style="color: #1976D2;">updated the inspection schedule</strong> for the property at ${payload.location}.</p>
                <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
                  <p style="color: #34A853;"><strong>LOI Accepted:</strong></p>
                  <li><strong>LOI Status:</strong> Accepted</li>
                </ul>
                <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px;">
                  <p><strong>Updated Inspection Details:</strong></p>
                  <li><strong>Original Date:</strong> ${payload.inspectionDateTime?.oldDateTime?.newDate}</li>
                  <li><strong>Original Time:</strong> ${payload.inspectionDateTime?.oldDateTime?.oldTime}</li>
                  <li style="margin-top: 10px; color: #1976D2;"><strong>New Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate}</li>
                  <li style="color: #1976D2;"><strong>New Time:</strong> ${payload.inspectionDateTime?.newDateTime?.newTime}</li>
                </ul>
                <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`;
            } else {
              htmlContent = `
                <p>Hi ${sellerName},</p>
                <p style="margin-top: 10px;">You've successfully <span style="color: #1AAD1F;">accepted</span> the buyer's LOI for the property at ${payload.location}.</p>
                <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
                  <p style="color: #34A853;"><strong>LOI Accepted:</strong></p>
                  <li><strong>Inspection Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate} <span style="color: #34A853;">(Confirmed)</span></li>
                  <li><strong>Inspection Time:</strong> ${payload.inspectionDateTime?.newDateTime?.newTime} <span style="color: #34A853;">(Confirmed)</span></li>
                </ul>
                <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`;
            }
          } else {
            htmlContent = `
              <p>Hi ${sellerName},</p>
              <p style="margin-top: 10px;">The buyer's LOI has been accepted, and the inspection date has been Approved for inspection.</p>
              <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
                <p><strong>Inspection Details:</strong></p>
                <li><strong>Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate}</li>
                <li><strong>Time:</strong> ${payload.inspectionDateTime?.newDateTime?.newTime}</li>
              </ul>
              <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`;
          }
        }
        break;

      case "reject":
        if (recipientType === "buyer") {
          if (isInitiator) {
            htmlContent = `
              <p>Hi ${buyerName},</p>
              <p style="margin-top: 10px;">You have <span style="color: #FF2539;">withdrawn</span> your LOI offer for the property at ${payload.location}.</p>
              <ul style="background-color: #FFE7E5; padding: 25px 20px; border-radius: 10px; margin-top: 15px; list-style: none;">
                <p style="color: #FF2539;"><strong>LOI Status:</strong></p>
                <li><strong>Status:</strong> Withdrawn</li>
                <li><strong>You can browse other properties or submit a new offer if you're still interested.</strong></li>
              </ul>
              <p style="margin-top: 15px;">Thank you for your interest.</p>`;
          } else {
            htmlContent = `
              <p>Hi ${buyerName},</p>
              <p style="margin-top: 10px;">The seller has <span style="color: #FF2539;">rejected</span> your LOI offer, but there's still an opportunity to inspect the property.</p>
              <ul style="background-color: #FAFAFA; padding: 25px 20px; border-radius: 10px; margin-top: 15px; list-style: none;">
                <p style="color: #34A853;"><strong>Here are the next steps:</strong></p>
                <li><strong>Inspection Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate}</li>
                <li><strong>You can submit a new offer after the inspection if you're still interested.</strong></li>
              </ul>
              <p style="margin-top: 15px;">Would you like to continue with the inspection?</p>
              
              <div style="margin-top: 20px;">
                <a href="${payload.buyerResponseLink}" style="display: inline-block; width: 180px; height: 40px; background-color: #1A7F64; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-right: 10px;">
                  Continue Inspection
                </a>
                <a href="${payload.browseLink}" style="display: inline-block; width: 162px; height: 40px; background-color: #6C757D; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                  Browse Properties
                </a>
              </div>`;
          }
        } else {
          if (isInitiator) {
            htmlContent = `
              <p>Hi ${sellerName},</p>
              <p style="margin-top: 10px;">You've successfully <span style="color: #FF2539;">rejected</span> the buyer's LOI for the property at ${payload.location}.</p>
              <ul style="background-color: #FFE7E5; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
                <p style="color: #FF2539;"><strong>LOI Rejected:</strong></p>
                <li><strong>Inspection Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate}</li>
                <li><strong>Inspection Time:</strong> ${payload.inspectionDateTime?.newDateTime?.newTime}</li>
              </ul>
              <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`;
          } else {
            htmlContent = `
              <p>Hi ${sellerName},</p>
              <p style="margin-top: 10px;">The buyer's LOI has been rejected, and the inspection date has been <span style="color: #1AAD1F;">Approved</span> for inspection.</p>
              <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
                <p><strong>Inspection Details:</strong></p>
                <li><strong>Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate}</li>
                <li><strong>Time:</strong> ${payload.inspectionDateTime?.newDateTime?.newTime}</li>
              </ul>
              <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`;
          }
        }
        break;

      case "counter":
        if (isInitiator) {
          htmlContent = `
            <p>Hi ${recipientName},</p>
            <p style="margin-top: 10px;">You have successfully uploaded a <span style="color: #1976D2;">counter LOI document</span> for the property at ${payload.location}.</p>
            <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
              <p style="color: #34A853;"><strong>Details:</strong></p>
              <li><strong>Inspection Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate}</li>
              <li><strong>Counter Document:</strong> Uploaded</li>
            </ul>
            <p style="margin-top: 15px;">The buyer will be notified to review your counter LOI document.</p>`;
        } else {
          htmlContent = `
            <p>Hi ${recipientName},</p>
            <p style="margin-top: 10px;">The seller has reviewed your LOI offer and responded with a <span style="color: #1976D2;">counter LOI document</span>. The inspection has also been approved.</p>
            <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
              <p style="color: #34A853;"><strong>Details:</strong></p>
              <li><strong>Inspection Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate}</li>
              <li><strong>Seller's Counter Document:</strong> <a href="${payload.documentUrl}">View Document</a></li>
            </ul>
            
            <p style="margin-top: 15px;">Please review the counter LOI document and respond accordingly.</p>
            
            <div style="margin-top: 20px;">
              <a href="${payload.buyerResponseLink}" style="display: inline-block; width: 140px; height: 40px; background-color: #1A7F64; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-right: 10px;">
                Accept LOI
              </a>
              <a href="${payload.buyerResponseLink}" style="display: inline-block; width: 140px; height: 40px; background-color: #DC3545; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-right: 10px;">
                Reject LOI
              </a>
              <a href="${payload.buyerResponseLink}" style="display: inline-block; width: 140px; height: 40px; background-color: #FFC107; color: #000; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                Counter LOI
              </a>
            </div>`;
        }
        break;

      case "request_changes":
        htmlContent = LOIRequestChangesTemplate(recipientName, payload, isInitiator);
        break;
    }
  } else {
    // Price negotiation templates
    switch (action) {
      case "accept":
        if (recipientType === "buyer") {
          htmlContent = NegotiationAcceptedTemplate(buyerName, payload, isInitiator);
        } else {
          if (isInitiator) {
            const dateTimeChanged = payload.inspectionDateTime?.dateTimeChanged;
            if (dateTimeChanged) {
              htmlContent = `
                <p>Hi ${sellerName},</p>
                <p style="margin-top: 10px;">You've successfully <span style="color: #1AAD1F;">accepted</span> the buyer's offer and <strong style="color: #1976D2;">updated the inspection schedule</strong> for the property at ${payload.location}.</p>
                <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
                  <p style="color: #34A853;"><strong>Offer Accepted:</strong></p>
                  <li><strong>Buyer Price:</strong> ${formatPrice(payload.negotiationPrice) || "N/A"}</li>
                </ul>
                <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px;">
                  <p><strong>Updated Inspection Details:</strong></p>
                  <li><strong>Original Date:</strong> ${payload.inspectionDateTime?.oldDateTime?.newDate || "N/A"}</li>
                  <li><strong>Original Time:</strong> ${payload.inspectionDateTime?.oldDateTime?.oldTime || "N/A"}</li>
                  <li style="margin-top: 10px; color: #1976D2;"><strong>New Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate || "N/A"}</li>
                  <li style="color: #1976D2;"><strong>New Time:</strong> ${payload.inspectionDateTime?.newDateTime?.newTime || "N/A"}</li>
                </ul>
                <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`;
            } else {
              htmlContent = `
                <p>Hi ${sellerName},</p>
                <p style="margin-top: 10px;">You've successfully <span style="color: #1AAD1F;">accepted</span> the buyer's offer for the property at ${payload.location}.</p>
                <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
                  <p style="color: #34A853;"><strong>Offer Accepted:</strong></p>
                  <li><strong>Buyer Price:</strong> ${formatPrice(payload.negotiationPrice) || "N/A"}</li>
                </ul>
                <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px;">
                  <p><strong>Inspection Details:</strong></p>
                  <li><strong>Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate || "N/A"} <span style="color: #34A853;">(Confirmed)</span></li>
                  <li><strong>Time:</strong> ${payload.inspectionDateTime?.newDateTime?.newTime || "N/A"} <span style="color: #34A853;">(Confirmed)</span></li>
                </ul>
                <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`;
            }
          } else {
            htmlContent = `
              <p>Hi ${sellerName},</p>
              <p style="margin-top: 10px;">The buyer's offer has been accepted, and the inspection date has been Approved for inspection.</p>
              <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
                <p style="color: #34A853;"><strong>Offer Accepted:</strong></p>
                <li><strong>Buyer Price:</strong> ${formatPrice(payload.negotiationPrice) || "N/A"}</li>
              </ul>
              <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px;">
                <p><strong>Inspection Details:</strong></p>
                <li><strong>Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate || "N/A"}</li>
                <li><strong>Time:</strong> ${payload.inspectionDateTime?.newDateTime?.newTime || "N/A"}</li>
              </ul>
              <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`;
          }
        }
        break;

      case "reject":
        if (recipientType === "buyer") {
          if (isInitiator) {
            htmlContent = `
              <p>Hi ${buyerName},</p>
              <p style="margin-top: 10px;">You have <span style="color: #FF2539;">withdrawn</span> your negotiation offer for the property at ${payload.location}.</p>
              <ul style="background-color: #FFE7E5; padding: 25px 20px; border-radius: 10px; margin-top: 15px; list-style: none;">
                <p style="color: #FF2539;"><strong>Offer Status:</strong></p>
                <li><strong>Status:</strong> Withdrawn</li>
                <li><strong>You can browse other properties or submit a new offer if you're still interested.</strong></li>
              </ul>
              <p style="margin-top: 15px;">Thank you for your interest.</p>`;
          } else {
            htmlContent = `
              <p>Hi ${buyerName},</p>
              <p style="margin-top: 10px;">The seller has <span style="color: #FF2539;">rejected</span> your negotiation offer, but there's still an opportunity to inspect the property.</p>
              <ul style="background-color: #FAFAFA; padding: 25px 20px; border-radius: 10px; margin-top: 15px; list-style: none;">
                <p style="color: #34A853;"><strong>Here are the next steps:</strong></p>
                <li><strong>Inspection Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate || "N/A"}</li>
                <li><strong>Inspection Time:</strong> ${payload.inspectionDateTime?.newDateTime?.newTime || "N/A"}</li>
                <li><strong>You can submit a new offer after the inspection if you're still interested.</strong></li>
              </ul>
              <p style="margin-top: 15px;">Would you like to continue with the inspection?</p>
              
              <div style="margin-top: 20px;">
                <a href="${payload.buyerResponseLink}" style="display: inline-block; width: 180px; height: 40px; background-color: #1A7F64; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-right: 10px;">
                  Continue Inspection
                </a>
                <a href="${payload.browseLink}" style="display: inline-block; width: 162px; height: 40px; background-color: #6C757D; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                  Browse Properties
                </a>
              </div>`;
          }
        } else {
          if (isInitiator) {
            htmlContent = `
              <p>Hi ${sellerName},</p>
              <p style="margin-top: 10px;">You've successfully <span style="color: #FF2539;">rejected</span> the buyer's offer for the property at ${payload.location}.</p>
              <ul style="background-color: #FFE7E5; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
                <p style="color: #FF2539;"><strong>Offer Rejected:</strong></p>
                <li><strong>Buyer Price:</strong> ${formatPrice(payload.negotiationPrice) || "N/A"}</li>
              </ul>
              <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
                <p><strong>Inspection Details:</strong></p>
                <li><strong>Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate || "N/A"}</li>
                <li><strong>Time:</strong> ${payload.inspectionDateTime?.newDateTime?.newTime || "N/A"}</li>
              </ul>
              <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`;
          } else {
            htmlContent = `
              <p>Hi ${sellerName},</p>
              <p style="margin-top: 10px;">The buyer's offer has been rejected, and the inspection date has been <span style="color: #1AAD1F;">Approved</span> for inspection.</p>
              <ul style="background-color: #FFE7E5; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
                <p style="color: #FF2539;"><strong>Offer Rejected:</strong></p>
                <li><strong>Buyer Price:</strong> ${formatPrice(payload.negotiationPrice) || "N/A"}</li>
              </ul>
              <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
                <p><strong>Inspection Details:</strong></p>
                <li><strong>Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate || "N/A"}</li>
                <li><strong>Time:</strong> ${payload.inspectionDateTime?.newDateTime?.newTime || "N/A"}</li>
              </ul>
              <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`;
          }
        }
        break;

      case "counter":
        if (recipientType === "buyer") {
          htmlContent = CounterBuyerTemplate(buyerName, payload, isInitiator);
        } else {
          if (isInitiator) {
            const dateTimeChanged = payload.inspectionDateTime?.dateTimeChanged;
            if (dateTimeChanged) {
              htmlContent = `
                <p>Hi ${sellerName},</p>
                <p style="margin-top: 10px;">You've successfully <span style="color: #1AAD1F;">countered</span> the buyer's offer and <strong style="color: #1976D2;">updated the inspection schedule</strong> for the property at ${payload.location}.</p>
                <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
                  <p><strong>Negotiation:</strong></p>
                  <li><strong>Buyer Price:</strong> ${formatPrice(payload.negotiationPrice) || "N/A"}</li>
                  <li><strong>Your Counter Offer:</strong> ${formatPrice(payload.sellerCounterOffer) || "N/A"}</li>
                </ul>
                <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
                  <p><strong>Updated Inspection Details:</strong></p>
                  <li><strong>Original Date:</strong> ${payload.inspectionDateTime?.oldDateTime?.newDate || "N/A"}</li>
                  <li><strong>Original Time:</strong> ${payload.inspectionDateTime?.oldDateTime?.oldTime || "N/A"}</li>
                  <li style="margin-top: 10px; color: #1976D2;"><strong>New Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate || "N/A"}</li>
                  <li style="color: #1976D2;"><strong>New Time:</strong> ${payload.inspectionDateTime?.newDateTime?.newTime || "N/A"}</li>
                </ul>
                <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`;
            } else {
              htmlContent = `
                <p>Hi ${sellerName},</p>
                <p style="margin-top: 10px;">You've successfully <span style="color: #1AAD1F;">countered</span> the buyer's offer for the property at ${payload.location}.</p>
                <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
                  <p><strong>Negotiation:</strong></p>
                  <li><strong>Buyer Price:</strong> ${formatPrice(payload.negotiationPrice) || "N/A"}</li>
                  <li><strong>Your Counter Offer:</strong> ${formatPrice(payload.sellerCounterOffer) || "N/A"}</li>
                </ul>
                <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
                  <p><strong>Inspection Details:</strong></p>
                  <li><strong>Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate || "N/A"} <span style="color: #34A853;">(Confirmed)</span></li>
                  <li><strong>Time:</strong> ${payload.inspectionDateTime?.newDateTime?.newTime || "N/A"} <span style="color: #34A853;">(Confirmed)</span></li>
                </ul>
                <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`;
            }
          } else {
            htmlContent = `
              <p>Hi ${sellerName},</p>
              <p style="margin-top: 10px;">A counter offer has been made for the buyer's offer, and the inspection date has been <span style="color: #1AAD1F;">Approved</span> for inspection.</p>
              <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
                <p><strong>Negotiation:</strong></p>
                <li><strong>Buyer Price:</strong> ${formatPrice(payload.negotiationPrice) || "N/A"}</li>
                <li><strong>Counter Offer:</strong> ${formatPrice(payload.sellerCounterOffer) || "N/A"}</li>
              </ul>
              <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
                <p><strong>Updated Inspection Details:</strong></p>
                <li><strong>Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate || "N/A"}</li>
                <li><strong>Time:</strong> ${payload.inspectionDateTime?.newDateTime?.newTime || "N/A"}</li>
              </ul>
              <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`;
          }
        }
        break;

      default:
        // Regular inspection acceptance (no negotiation)
        if (recipientType === "buyer") {
          htmlContent = InspectionAcceptedTemplate(buyerName, payload, isInitiator);
        } else {
          if (isInitiator) {
            const dateTimeChanged = payload.inspectionDateTime?.dateTimeChanged;
            if (dateTimeChanged) {
              htmlContent = `
                <p>Hi ${sellerName},</p>
                <p style="margin-top: 10px;">You've successfully <span style="color: #1AAD1F;">accepted</span> the inspection request and <strong style="color: #1976D2;">updated the inspection schedule</strong> for the property at ${payload.location}.</p>
                <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
                  <p><strong>Updated Inspection Details:</strong></p>
                  <li><strong>Original Date:</strong> ${payload.inspectionDateTime?.oldDateTime?.newDate || "N/A"}</li>
                  <li><strong>Original Time:</strong> ${payload.inspectionDateTime?.oldDateTime?.oldTime || "N/A"}</li>
                  <li style="margin-top: 10px; color: #1976D2;"><strong>New Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate || "N/A"}</li>
                  <li style="color: #1976D2;"><strong>New Time:</strong> ${payload.inspectionDateTime?.newDateTime?.newTime || "N/A"}</li>
                </ul>
                <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`;
            } else {
              htmlContent = `
                <p>Hi ${sellerName},</p>
                <p style="margin-top: 10px;">You've successfully <span style="color: #1AAD1F;">accepted</span> the inspection request for the property at ${payload.location}.</p>
                <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
                  <p><strong>Inspection Details:</strong></p>
                  <li><strong>Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate || "N/A"} <span style="color: #34A853;">(Confirmed)</span></li>
                  <li><strong>Time:</strong> ${payload.inspectionDateTime?.newDateTime?.newTime || "N/A"} <span style="color: #34A853;">(Confirmed)</span></li>
                </ul>
                <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`;
            }
          } else {
            htmlContent = `
              <p>Hi ${sellerName},</p>
              <p style="margin-top: 10px;">The inspection request has been accepted.</p>
              <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
                <p><strong>Inspection Details:</strong></p>
                <li><strong>Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate || "N/A"}</li>
                <li><strong>Time:</strong> ${payload.inspectionDateTime?.newDateTime?.newTime || "N/A"}</li>
              </ul>
              <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`;
          }
        }
    }
  }

  // Generate plain text version
  const text = htmlContent
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();

  return { html: htmlContent, text };
}