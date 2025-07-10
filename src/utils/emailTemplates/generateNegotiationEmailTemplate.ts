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

  let introMessage = "";
  let confirmedDateTimeHtml = "";
  let inspectionDetailsBgColor = "#FAFAFA";

  if (inspectionDateStatus === "available") {
    introMessage = `Great news! The seller has <span style="color: #1AAD1F;">accepted</span> your negotiation offer and confirmed the inspection for the property at ${location}.`;
    confirmedDateTimeHtml = `
      <ul style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p><strong>Here are the details:</strong></p>
        <li><strong>Inspection Date:</strong> ${inspectionDate || "N/A"}</li>
        <li><strong>Inspection Time:</strong> ${inspectionTime || "N/A"}</li>
      </ul>`;
  } else if (inspectionDateStatus === "countered") {
    introMessage = `Great news! The seller has <span style="color: #1AAD1F;">accepted</span> your negotiation offer. The originally requested inspection date was countered, and a <strong style="color: #1AAD1F;">new date and time have been confirmed</strong> for the inspection at ${location}.`;
    confirmedDateTimeHtml = `
      <ul style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p><strong>Here are the details:</strong></p>
        <li><strong>Original Inspection Date:</strong> ${inspectionDateTime?.oldDateTime?.newDate || "N/A"}</li>
        <li><strong>Original Inspection Time:</strong> ${inspectionDateTime?.oldDateTime?.oldTime || "N/A"}</li>
        <li style="margin-top: 10px;"><strong>New Confirmed Date:</strong> ${inspectionDateTime?.newDateTime?.newDate || "N/A"}</li>
        <li><strong>New Confirmed Time:</strong> ${inspectionDateTime?.newDateTime?.newTime || "N/A"}</li>
      </ul>`;
  } else if (inspectionDateStatus === "unavailable") {
    inspectionDetailsBgColor = "#FFECED";
    introMessage = `The seller has <span style="color: #D32F2F;">accepted</span> your negotiation offer for the property at ${location}, however, the originally requested inspection date was unavailable. Please check for new proposals or follow up if needed.`;

    if (inspectionDate && inspectionTime) {
      confirmedDateTimeHtml = `
        <ul style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p><strong>Inspection Status:</strong></p>
          <li>The requested inspection date was unavailable.</li>
          <li>A new date and time has been suggested: <strong>${inspectionDate} at ${inspectionTime}</strong>.</li>
          <li>Please refer to your dashboard for confirmation or alternative arrangements.</li>
        </ul>`;
    } else {
      confirmedDateTimeHtml = `
        <ul style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p><strong>Inspection Status:</strong></p>
          <li>The requested inspection date was unavailable.</li>
          <li>Please refer to your dashboard or recent communications for alternative arrangements.</li>
        </ul>`;
    }
  } else {
    introMessage = `Great news! The seller has <span style="color: #1AAD1F;">accepted</span> your negotiation offer and confirmed the inspection for the property at ${location}. Please review the details below.`;
    confirmedDateTimeHtml = `
      <ul style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p><strong>Here are the details:</strong></p>
        <li><strong>Inspection Date:</strong> ${inspectionDate || "N/A"}</li>
        <li><strong>Inspection Time:</strong> ${inspectionTime || "N/A"}</li>
      </ul>`;
  }

  return `
    <p>Dear ${buyerName},</p>
    <p style="margin-top: 10px;">${introMessage}</p>

    <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p><strong>Offer Details:</strong></p>
        <li><strong>Accepted Price:</strong> ${formatPrice(negotiationPrice) || "N/A"}</li>
    </ul>

    ${confirmedDateTimeHtml}

    <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px;">
      <p><strong>Property Details:</strong></p>
      <li><strong>Property Type:</strong> ${propertyType || "N/A"}</li>
      <li><strong>Location:</strong> ${location || "N/A"}</li>
      <li><strong>Original Price:</strong> ${formatPrice(price) || "N/A"}</li>
    </ul>

    <p style="margin-top: 15px;">You'll receive a reminder before the inspection. If you have any questions, feel free to reach out.</p>
    <p style="margin-top: 15px;">We look forward to seeing you then. If you need to reschedule, please let us know.</p>

    <a href="${propertyData.buyerResponseLink}" style="display: inline-block; width: 162px; height: 40px; background-color: #1A7F64; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold; gap: 8px; padding: 8px 16px;">
      Reschedule Inspection
    </a>`;
}

function CounterBuyerTemplate(buyerName: string, propertyData: any): string {
  const {
    sellerCounterOffer,
    propertyType,
    location,
    price,
    inspectionDateStatus,
    inspectionDateTime,
  } = propertyData;

  const inspectionDate = inspectionDateTime?.newDateTime?.newDate;
  const inspectionTime = inspectionDateTime?.newDateTime?.newTime;

  let introMessage = "";
  let inspectionDetailsHtml = "";
  let inspectionDetailsBgColor = "#FAFAFA";

  if (inspectionDateStatus === "available") {
    introMessage = `The seller has reviewed your offer and responded with a <span style="color: #1976D2;">counter-offer</span>. The inspection has also been approved.`;
    inspectionDetailsHtml = `
      <ul style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p style="color: #34A853;"><strong>Inspection Details:</strong></p>
        <li><strong>Date:</strong> ${inspectionDate || "N/A"}</li>
        <li><strong>Time:</strong> ${inspectionTime || "N/A"}</li>
      </ul>`;
  } else if (inspectionDateStatus === "countered") {
    introMessage = `The seller has reviewed your offer and responded with a <span style="color: #1976D2;">counter-offer</span>. They have also <strong style="color: #34A853;">proposed new inspection details</strong>.`;
    inspectionDetailsHtml = `
      <ul style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p style="color: #34A853;"><strong>Proposed Inspection Details:</strong></p>
        <li><strong>Original Requested Date:</strong> ${inspectionDateTime?.oldDateTime?.newDate || "N/A"}</li>
        <li><strong>Original Requested Time:</strong> ${inspectionDateTime?.oldDateTime?.oldTime || "N/A"}</li>
        <li style="margin-top: 10px;"><strong>New Proposed Date:</strong> ${inspectionDateTime?.newDateTime?.newDate || "N/A"}</li>
        <li><strong>New Proposed Time:</strong> ${inspectionDateTime?.newDateTime?.newTime || "N/A"}</li>
      </ul>`;
  } else if (inspectionDateStatus === "unavailable") {
    inspectionDetailsBgColor = "#FFECED";
    introMessage = `The seller has reviewed your offer and responded with a <span style="color: #1976D2;">counter-offer</span>. However, the originally requested inspection date was unavailable.`;

    if (inspectionDate && inspectionTime) {
      inspectionDetailsHtml = `
        <ul style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p style="color: #D32F2F;"><strong>Inspection Status:</strong></p>
          <li>The requested inspection date was unavailable.</li>
          <li>A new date and time has been suggested: <strong>${inspectionDate} at ${inspectionTime}</strong>.</li>
          <li>Please review your dashboard for confirmation or alternative arrangements.</li>
        </ul>`;
    } else {
      inspectionDetailsHtml = `
        <ul style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p style="color: #D32F2F;"><strong>Inspection Status:</strong></p>
          <li>The requested inspection date was unavailable.</li>
          <li>Please refer to your dashboard or recent communications for alternative arrangements.</li>
        </ul>`;
    }
  } else {
    introMessage = `The seller has reviewed your offer and responded with a <span style="color: #1976D2;">counter-offer</span>. The inspection has also been approved.`;
    inspectionDetailsHtml = `
      <ul style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p style="color: #34A853;"><strong>Inspection Details:</strong></p>
        <li><strong>Date:</strong> ${inspectionDate || "N/A"}</li>
        <li><strong>Time:</strong> ${inspectionTime || "N/A"}</li>
      </ul>`;
  }

  return `
    <p>Hi ${buyerName},</p>
    <p style="margin-top: 10px;">${introMessage}</p>
    
    <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
      <p style="color: #34A853;"><strong>Offer Details:</strong></p>
      <li><strong>Seller's Counter-Offer:</strong> ${formatPrice(sellerCounterOffer) || "N/A"}</li>
    </ul>

    <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px;">
      <p><strong>Property Details:</strong></p>
      <li><strong>Property Type:</strong> ${propertyType || "N/A"}</li>
      <li><strong>Location:</strong> ${location || "N/A"}</li>
      <li><strong>Original Price:</strong> ${formatPrice(price) || "N/A"}</li>
    </ul>

    ${inspectionDetailsHtml}

    <p style="margin-top: 15px;">Please click below to accept or decline the Offer.</p>

    <div style="display: flex; width: 104px; height: 40px; gap: 16px;">
      <a href="${propertyData.buyerResponseLink}" style="flex: 1; background-color: #1A7F64; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold;">View Offer</a>
    </div>

    <p style="margin-top: 15px;">Thanks for your flexibility!</p>`;
}

function InspectionAcceptedTemplate(
  buyerName: string,
  propertyData: any,
): string {
  const {
    location,
    price,
    propertyType,
    inspectionDateStatus,
    inspectionDateTime,
  } = propertyData;

  const inspectionDate = inspectionDateTime?.newDateTime?.newDate;
  const inspectionTime = inspectionDateTime?.newDateTime?.newTime;

  let introMessage = "";
  let confirmedDateTimeHtml = "";
  let inspectionDetailsBgColor = "#EEF7FF";

  if (inspectionDateStatus === "available") {
    introMessage = `Good news! The seller has <span style="color: #1AAD1F;">accepted</span> your inspection request for ${location}.`;
    confirmedDateTimeHtml = `
      <ul style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p><strong>Confirmed Date & Time:</strong></p>
        <li><strong>Date:</strong> ${inspectionDate || "N/A"}</li>
        <li><strong>Time:</strong> ${inspectionTime || "N/A"}</li>
      </ul>`;
  } else if (inspectionDateStatus === "countered") {
    introMessage = `Good news! The seller has <span style="color: #1AAD1F;">accepted</span> your inspection request for ${location}. The originally requested date was unavailable, and a <strong style="color: #1AAD1F;">new date and time have been confirmed</strong>.`;
    confirmedDateTimeHtml = `
      <ul style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p><strong>Confirmed Date & Time:</strong></p>
        <li><strong>Original Date:</strong> ${inspectionDateTime?.oldDateTime?.newDate || "N/A"}</li>
        <li><strong>Original Time:</strong> ${inspectionDateTime?.oldDateTime?.oldTime || "N/A"}</li>
        <li style="margin-top: 10px;"><strong>New Confirmed Date:</strong> ${inspectionDateTime?.newDateTime?.newDate || "N/A"}</li>
        <li><strong>New Confirmed Time:</strong> ${inspectionDateTime?.newDateTime?.newTime || "N/A"}</li>
      </ul>`;
  } else if (inspectionDateStatus === "unavailable") {
    inspectionDetailsBgColor = "#FFECED";
    introMessage = `The seller has <span style="color: #D32F2F;">responded</span> to your inspection request for ${location}. The originally requested date was unavailable. Please check for new proposals or follow up if needed.`;

    if (inspectionDate && inspectionTime) {
      confirmedDateTimeHtml = `
        <ul style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p><strong>Confirmed Date & Time:</strong></p>
          <li><strong>Date:</strong> ${inspectionDate}</li>
          <li><strong>Time:</strong> ${inspectionTime}</li>
        </ul>`;
    } else {
      confirmedDateTimeHtml = `
        <ul style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p><strong>Inspection Status:</strong></p>
          <li>The requested inspection date was unavailable.</li>
          <li>Please refer to your dashboard or recent communications for alternative arrangements.</li>
        </ul>`;
    }
  } else {
    introMessage = `Good news! The seller has <span style="color: #1AAD1F;">accepted</span> your inspection request for ${location}. Please review the details below.`;
    confirmedDateTimeHtml = `
      <ul style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p><strong>Confirmed Date & Time:</strong></p>
        <li><strong>Date:</strong> ${inspectionDate || "N/A"}</li>
        <li><strong>Time:</strong> ${inspectionTime || "N/A"}</li>
      </ul>`;
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

    <p style="margin-top: 15px;">You'll receive a reminder before the inspection. If you have any questions, feel free to reach out.</p>
    <p style="margin-top: 15px;">We look forward to seeing you then. If you need to reschedule, please let us know.</p>

    <a href="${propertyData.buyerResponseLink}" style="display: inline-block; width: 162px; height: 40px; background-color: #1A7F64; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold; gap: 8px; padding: 8px 16px;">
      Reschedule Inspection
    </a>`;
}

// LOI Templates
function LOINegotiationAcceptedTemplate(
  buyerName: string,
  propertyData: any,
): string {
  return `
    <p>Dear ${buyerName},</p>
    <p style="margin-top: 10px;">Great news! The seller has <span style="color: #1AAD1F;">accepted</span> your Letter of Intent (LOI) for the property at ${propertyData.location}.</p>

    <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
      <p><strong>Please find the details:</strong></p>
      <li><strong>Inspection Date:</strong> ${propertyData.inspectionDateTime?.newDateTime?.newDate} ${propertyData.inspectionDateTime?.newDateTime?.newTime}</li>
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

// Main interface
interface EmailTemplateParams {
  userType: "seller" | "buyer";
  action: "accept" | "reject" | "counter" | "request_changes";
  buyerName: string;
  sellerName: string;
  recipientType: "buyer" | "seller";
  payload: any;
  isLOI: boolean;
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
  } = params;

  const recipientName = recipientType === "buyer" ? buyerName : sellerName;
  let htmlContent = "";

  // Generate specific email content based on action and recipient
  if (isLOI) {
    // LOI-specific templates
    switch (action) {
      case "accept":
        if (recipientType === "buyer") {
          htmlContent = LOINegotiationAcceptedTemplate(buyerName, payload);
        } else {
          htmlContent = `
            <p>Hi ${sellerName},</p>
            <p style="margin-top: 10px;">You've successfully <span style="color: #1AAD1F;">accepted</span> the buyer's LOI, and the inspection date has been Approved for inspection.</p>
            <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
              <p><strong>Inspection Details:</strong></p>
              <li><strong>Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate}</li>
              <li><strong>Time:</strong> ${payload.inspectionDateTime?.newDateTime?.newTime}</li>
            </ul>
            <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`;
        }
        break;

      case "reject":
        if (recipientType === "buyer") {
          htmlContent = `
            <p>Hi ${buyerName},</p>
            <p style="margin-top: 10px;">The seller has <span style="color: #FF2539;">rejected</span> your LOI offer, but there's still an opportunity to inspect the property.</p>
            <ul style="background-color: #FAFAFA; padding: 25px 20px; border-radius: 10px; margin-top: 15px; list-style: none;">
              <p style="color: #34A853;"><strong>Here are the next steps:</strong></p>
              <li><strong>Inspection Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate}</li>
              <li><strong>You can submit a new offer after the inspection if you're still interested.</strong></li>
            </ul>
            <p style="margin-top: 15px;">Would you like to continue with the inspection?</p>`;
        } else {
          htmlContent = `
            <p>Hi ${sellerName},</p>
            <p style="margin-top: 10px;">You've successfully <span style="color: #FF2539;">Rejected</span> the Developer LOI, and the inspection date has been <span style="color: #1AAD1F;">Approved</span> for inspection.</p>
            <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
              <p><strong>Inspection Details:</strong></p>
              <li><strong>Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate}</li>
              <li><strong>Time:</strong> ${payload.inspectionDateTime?.newDateTime?.newTime}</li>
            </ul>
            <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`;
        }
        break;

      case "counter":
        htmlContent = `
          <p>Hi ${recipientName},</p>
          <p style="margin-top: 10px;">The seller has reviewed your LOI offer and responded with a <span style="color: #1976D2;">counter-offer</span>. The inspection has also been approved.</p>
          <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
            <p style="color: #34A853;"><strong>Details:</strong></p>
            <li><strong>Inspection Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate}</li>
            <li><strong>Seller's Counter Document:</strong> <a href="${payload.documentUrl}">View Document</a></li>
          </ul>`;
        break;

      case "request_changes":
        htmlContent = `
          <p>Hi ${recipientName},</p>
          <p style="margin-top: 10px;">The seller has requested changes to your Letter of Intent.</p>
          <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
            <p><strong>Requested Changes:</strong></p>
            <li><strong>Reason:</strong> ${payload.reason}</li>
            <li><strong>Inspection Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate}</li>
            <li><strong>Inspection Time:</strong> ${payload.inspectionDateTime?.newDateTime?.newTime}</li>
          </ul>`;
        break;
    }
  } else {
    // Price negotiation templates
    switch (action) {
      case "accept":
        if (recipientType === "buyer") {
          htmlContent = NegotiationAcceptedTemplate(buyerName, payload);
        } else {
          htmlContent = `
            <p>Hi ${sellerName},</p>
            <p style="margin-top: 10px;">You've successfully <span style="color: #1AAD1F;">accepted</span> the buyer's offer, and the inspection date has been Approved for inspection.</p>
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
        break;

      case "reject":
        if (recipientType === "buyer") {
          htmlContent = `
            <p>Hi ${buyerName},</p>
            <p style="margin-top: 10px;">The seller has <span style="color: #FF2539;">rejected</span> your negotiation offer, but there's still an opportunity to inspect the property.</p>
            <ul style="background-color: #FAFAFA; padding: 25px 20px; border-radius: 10px; margin-top: 15px; list-style: none;">
              <p style="color: #34A853;"><strong>Here are the next steps:</strong></p>
              <li><strong>Inspection Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate || "N/A"}</li>
              <li><strong>Inspection Time:</strong> ${payload.inspectionDateTime?.newDateTime?.newTime || "N/A"}</li>
              <li><strong>You can submit a new offer after the inspection if you're still interested.</strong></li>
            </ul>
            <p style="margin-top: 15px;">Would you like to continue with the inspection?</p>`;
        } else {
          htmlContent = `
            <p>Hi ${sellerName},</p>
            <p style="margin-top: 10px;">You've successfully <span style="color: #FF2539;">rejected</span> the buyer's offer, and the inspection date has been <span style="color: #1AAD1F;">Approved</span> for inspection.</p>
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
        break;

      case "counter":
        if (recipientType === "buyer") {
          htmlContent = CounterBuyerTemplate(buyerName, payload);
        } else {
          htmlContent = `
            <p>Hi ${sellerName},</p>
            <p style="margin-top: 10px;">You've successfully <span style="color: #1AAD1F;">countered</span> the buyer's offer, and the inspection date has been <span style="color: #1AAD1F;">Approved</span> for inspection.</p>
            <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
              <p><strong>Negotiation:</strong></p>
              <li><strong>Buyer Price:</strong> ${formatPrice(payload.negotiationPrice) || "N/A"}</li>
              <li><strong>Your Counter Offer:</strong> ${formatPrice(payload.sellerCounterOffer) || "N/A"}</li>
            </ul>
            <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
              <p><strong>Updated Inspection Details:</strong></p>
              <li><strong>Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate || "N/A"}</li>
              <li><strong>Time:</strong> ${payload.inspectionDateTime?.newDateTime?.newTime || "N/A"}</li>
            </ul>
            <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`;
        }
        break;

      default:
        // Regular inspection acceptance (no negotiation)
        if (recipientType === "buyer") {
          htmlContent = InspectionAcceptedTemplate(buyerName, payload);
        } else {
          htmlContent = `
            <p>Hi ${sellerName},</p>
            <p style="margin-top: 10px;">You've successfully <span style="color: #1AAD1F;">accepted</span> the inspection request.</p>
            <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
              <p><strong>Inspection Details:</strong></p>
              <li><strong>Date:</strong> ${payload.inspectionDateTime?.newDateTime?.newDate || "N/A"}</li>
              <li><strong>Time:</strong> ${payload.inspectionDateTime?.newDateTime?.newTime || "N/A"}</li>
            </ul>
            <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`;
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
