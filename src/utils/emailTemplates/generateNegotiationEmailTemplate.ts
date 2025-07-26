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

const getInspectionModeInfo = (mode: string | undefined) => {
  if (mode === "in_person") {
    return { label: "In Person", inverse: "Virtual" };
  }
  if (mode === "virtual") {
    return { label: "Virtual", inverse: "In Person" };
  }
  return { label: "Unknown", inverse: null };
};


// Add these functions at the top of your file
function generateRejectSubject(
  recipientType: "buyer" | "seller",
  isInitiator: boolean,
  location: string,
  isLOI: boolean
): string {
  const prefix = isLOI ? "LOI" : "Offer";
  if (isInitiator) {
    return `${prefix} Rejected - Confirmation for ${location}`;
  } else {
    const actor = recipientType === "buyer" ? "Seller" : "Buyer";
    return `${prefix} Rejected by ${actor} - ${location}`;
  }
}

function generateCounterSubject(
  recipientType: "buyer" | "seller",
  isInitiator: boolean,
  location: string,
  isLOI: boolean
): string {
  const prefix = isLOI ? "LOI" : "Offer";
  if (isInitiator) {
    return `${prefix} Counter-Offer Sent - Confirmation for ${location}`;
  } else {
    const actor = recipientType === "buyer" ? "Seller" : "Buyer";
    return `${prefix} Counter-Offer from ${actor} - ${location}`;
  }
}

function generateAcceptSubject(
  recipientType: "buyer" | "seller",
  isInitiator: boolean,
  location: string,
  isLOI: boolean
): string {
  if (isLOI) {
    if (isInitiator) {
      return `LOI Accepted - Confirmation for ${location}`;
    } else {
      return `Great News! Your LOI has been Accepted - ${location}`;
    }
  } else {
    if (isInitiator) {
      return `Inspection Request Accepted - Confirmation for ${location}`;
    } else {
      return `Inspection Request Approved - ${location}`;
    }
  }
}

function generateRequestChangesSubject(
  recipientType: "buyer" | "seller",
  isInitiator: boolean,
  location: string,
  isLOI: boolean
): string {
  if (isInitiator) {
    return `LOI Changes Requested - Confirmation for ${location}`;
  } else {
    return `LOI Changes Requested - Action Required for ${location}`;
  }
}


/**
 * 
 * @param recipientName 
 * @param payload 
 * @param isInitiator 
 * @param recipientType 
 * @returns 
 */
function RejectTemplate(
  recipientName: string,
  payload: any,
  isInitiator: boolean,
  recipientType: "buyer" | "seller"
): string {
  const {
    location,
    price,
    negotiationPrice,
    propertyType,
    inspectionDateTime,
    modeChanged,
    inspectionMode
  } = payload;

  const inspectionDate = inspectionDateTime?.newDateTime?.newDate;
  const inspectionTime = inspectionDateTime?.newDateTime?.newTime;
  const oldDate = inspectionDateTime?.oldDateTime?.newDate;
  const oldTime = inspectionDateTime?.oldDateTime?.oldTime;
  const dateTimeChanged = inspectionDateTime?.dateTimeChanged;

  let introMessage = "";
  let inspectionDetailsHtml = "";
  let inspectionDetailsBgColor = "#FAFAFA";

  const modeInfo = getInspectionModeInfo(inspectionMode);

  if (isInitiator) {
    introMessage = `You have <span style="color: #FF2539;">rejected</span> the ${recipientType === "buyer" ? "seller's" : "buyer's"} offer for the property at ${location}.`;
  } else {
    introMessage = `The ${recipientType === "buyer" ? "seller" : "buyer"} has <span style="color: #FF2539;">rejected</span> your offer for the property at ${location}.`;

    inspectionDetailsHtml = `
      <ul class="content-block" style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px; list-style: none; margin-left: 0; padding-left: 20px; padding-right: 20px;">
        <p class="mobile-title" style="margin: 0 0 10px 0;"><strong>Inspection Details:</strong></p>
        ${
          dateTimeChanged
            ? `<li class="mobile-list-item" style="margin-bottom: 8px; word-wrap: break-word;"><strong>Original Date:</strong> ${oldDate || "N/A"}</li>
               <li class="mobile-list-item" style="margin-bottom: 8px; word-wrap: break-word;"><strong>Original Time:</strong> ${oldTime || "N/A"}</li>
               <li class="mobile-list-item" style="margin-top: 10px; margin-bottom: 8px; color: #1AAD1F; word-wrap: break-word;"><strong>New Date:</strong> ${inspectionDate || "N/A"}</li>
               <li class="mobile-list-item" style="color: #1AAD1F; margin-bottom: 8px; word-wrap: break-word;"><strong>New Time:</strong> ${inspectionTime || "N/A"}</li>`
            : `<li class="mobile-list-item" style="margin-bottom: 8px; word-wrap: break-word;"><strong>Date:</strong> ${inspectionDate || "N/A"}</li>
               <li class="mobile-list-item" style="margin-bottom: 8px; word-wrap: break-word;"><strong>Time:</strong> ${inspectionTime || "N/A"}</li>`
        }
        ${
          modeChanged
            ? `<li class="mobile-list-item" style="margin-top: 10px; margin-bottom: 8px; word-wrap: break-word;"><strong>Original Mode:</strong> ${modeInfo.inverse}</li>
               <li class="mobile-list-item" style="color: #1AAD1F; margin-bottom: 8px; word-wrap: break-word;"><strong>New Mode:</strong> ${modeInfo.label}</li>`
            : `<li class="mobile-list-item" style="margin-bottom: 8px; word-wrap: break-word;"><strong>Inspection Mode:</strong> ${modeInfo.label}</li>`
        }
      </ul>`;
  }

  return `
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <style>
        @media only screen and (max-width: 600px) {
          .email-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 10px !important;
          }
          .content-block {
            padding: 15px 15px !important;
            margin-top: 10px !important;
          }
          .button-container {
            text-align: center !important;
            margin-top: 15px !important;
          }
          .response-button {
            width: 90% !important;
            max-width: 280px !important;
            display: block !important;
            margin: 0 auto 10px auto !important;
            box-sizing: border-box !important;
          }
          .browse-button {
            width: 90% !important;
            max-width: 280px !important;
            display: block !important;
            margin: 0 auto !important;
            box-sizing: border-box !important;
          }
          .mobile-text {
            font-size: 14px !important;
            line-height: 1.4 !important;
          }
          .mobile-list-item {
            margin-bottom: 12px !important;
            font-size: 14px !important;
          }
          .mobile-title {
            font-size: 16px !important;
            margin-bottom: 15px !important;
          }
          .desktop-buttons {
            display: none !important;
          }
          .mobile-buttons {
            display: block !important;
          }
        }
        @media only screen and (max-width: 480px) {
          .content-block {
            padding: 12px 12px !important;
          }
          .mobile-text {
            font-size: 13px !important;
          }
          .mobile-list-item {
            font-size: 13px !important;
          }
        }
        @media only screen and (min-width: 601px) {
          .mobile-buttons {
            display: none !important;
          }
          .desktop-buttons {
            display: block !important;
          }
        }
      </style>
      
      <div class="email-container">
        <p class="mobile-text">Dear ${recipientName},</p>
        <p class="mobile-text" style="margin-top: 10px;">${introMessage}</p>
        
        <ul class="content-block" style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px; list-style: none; margin-left: 0; padding-left: 20px; padding-right: 20px;">
          <p class="mobile-title" style="margin: 0 0 10px 0;"><strong>Offer Details:</strong></p>
          <li class="mobile-list-item" style="margin-bottom: 8px; word-wrap: break-word;"><strong>${recipientType === "buyer" ? "Seller's" : "Buyer's"} Offer:</strong> ${formatPrice(negotiationPrice) || "N/A"}</li>
        </ul>
        
        ${inspectionDetailsHtml}
        
        <ul class="content-block" style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px; list-style: none; margin-left: 0; padding-left: 20px; padding-right: 20px;">
          <p class="mobile-title" style="margin: 0 0 10px 0;"><strong>Property Details:</strong></p>
          <li class="mobile-list-item" style="margin-bottom: 8px; word-wrap: break-word;"><strong>Property Type:</strong> ${propertyType || "N/A"}</li>
          <li class="mobile-list-item" style="margin-bottom: 8px; word-wrap: break-word;"><strong>Location:</strong> ${location || "N/A"}</li>
          <li class="mobile-list-item" style="margin-bottom: 8px; word-wrap: break-word;"><strong>Original Price:</strong> ${formatPrice(price) || "N/A"}</li>
        </ul>
        
        ${
          !isInitiator
            ? `
        <p class="mobile-text" style="margin-top: 15px;">You can continue with the inspection or browse other properties.</p>
        
        <!-- Desktop Button Layout -->
        <div class="desktop-buttons" style="margin-top: 20px;">
          <a href="${payload.responseLink}" style="display: inline-block; width: 180px; height: 40px; background-color: #1A7F64; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-right: 10px;">
            View Inspection Details
          </a>
          <a href="${payload.browseLink}" style="display: inline-block; width: 162px; height: 40px; background-color: #6C757D; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Browse Properties
          </a>
        </div>
        
        <!-- Mobile Button Layout -->
        <div class="mobile-buttons button-container" style="display: none; margin-top: 20px;">
          <a href="${payload.responseLink}" class="response-button" style="display: block; width: 180px; height: 40px; background-color: #1A7F64; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 0 auto 10px auto;">
            View Inspection Details
          </a>
          <a href="${payload.browseLink}" class="browse-button" style="display: block; width: 162px; height: 40px; background-color: #6C757D; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 0 auto;">
            Browse Properties
          </a>
        </div>
        `
            : `
        <p class="mobile-text" style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>
        `
        }
      </div>
    </div>`;
}


/**
 * 
 * @param recipientName 
 * @param payload 
 * @param isInitiator 
 * @param recipientType 
 * @returns 
 */
function CounterTemplate(
  recipientName: string,
  payload: any,
  isInitiator: boolean,
  recipientType: "buyer" | "seller"
): string {
  const {
    sellerCounterOffer,
    propertyType,
    location,
    price,
    inspectionDateTime,
    modeChanged,
    inspectionMode,
  } = payload;

  const inspectionDate = inspectionDateTime?.newDateTime?.newDate;
  const inspectionTime = inspectionDateTime?.newDateTime?.newTime;
  const dateTimeChanged = inspectionDateTime?.dateTimeChanged;

  let introMessage = "";
  let inspectionDetailsHtml = "";
  let inspectionDetailsBgColor = "#FAFAFA";

  const hasInspectionUpdate = dateTimeChanged || modeChanged;

  if (isInitiator) {
    introMessage = `You have successfully <span style="color: #1AAD1F;">countered</span> the ${recipientType === "buyer" ? "seller's" : "buyer's"} offer for the property at ${location}.`;
  } else {
    introMessage = `The ${recipientType === "buyer" ? "seller" : "buyer"} has <span style="color: #1AAD1F;">countered</span> your offer for the property at ${location}.`;
  }

  const modeInfo = getInspectionModeInfo(inspectionMode);

  if (hasInspectionUpdate) {
    introMessage += ` ${isInitiator ? "You've" : "They have"} also <strong style="color: #1AAD1F;">updated the inspection schedule</strong>.`;

    inspectionDetailsHtml = `
      <ul style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px; list-style: none; margin-left: 0; padding-left: 20px; padding-right: 20px;">
        <p style="margin: 0 0 10px 0;"><strong>Updated Inspection Schedule:</strong></p>
        ${dateTimeChanged ? `
          <li style="margin-bottom: 8px; word-wrap: break-word;"><strong>Original Date:</strong> ${inspectionDateTime?.oldDateTime?.newDate || "N/A"}</li>
          <li style="margin-bottom: 8px; word-wrap: break-word;"><strong>Original Time:</strong> ${inspectionDateTime?.oldDateTime?.oldTime || "N/A"}</li>
          <li style="margin-top: 10px; margin-bottom: 8px; color: #1AAD1F; word-wrap: break-word;"><strong>New Date:</strong> ${inspectionDate || "N/A"}</li>
          <li style="color: #1AAD1F; margin-bottom: 8px; word-wrap: break-word;"><strong>New Time:</strong> ${inspectionTime || "N/A"}</li>` : ""
        }
        ${modeChanged ? `
          <li style="margin-top: 10px; margin-bottom: 8px; word-wrap: break-word;"><strong>Previous Mode:</strong> ${modeInfo.inverse}</li>
          <li style="margin-bottom: 8px; word-wrap: break-word;"><strong>New Mode:</strong> <span style="color: #1AAD1F;">${modeInfo.label}</span></li>` : ""
        }
      </ul>`;
  } else {
    introMessage += ` The inspection schedule has been confirmed.`;

    inspectionDetailsHtml = `
      <ul style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px; list-style: none; margin-left: 0; padding-left: 20px; padding-right: 20px;">
        <p style="margin: 0 0 10px 0;"><strong>Inspection Details:</strong></p>
        <li style="margin-bottom: 8px; word-wrap: break-word;"><strong>Date:</strong> ${inspectionDate || "N/A"} <span style="color: #34A853;">(Confirmed)</span></li>
        <li style="margin-bottom: 8px; word-wrap: break-word;"><strong>Time:</strong> ${inspectionTime || "N/A"} <span style="color: #34A853;">(Confirmed)</span></li>
        <li style="margin-bottom: 8px; word-wrap: break-word;"><strong>Mode:</strong> ${modeInfo.label} <span style="color: #34A853;">(Confirmed)</span></li>
      </ul>`;
  }

  return `
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <style>
        @media only screen and (max-width: 600px) {
          .email-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 10px !important;
          }
          .content-block {
            padding: 15px 15px !important;
            margin-top: 10px !important;
          }
          .button-container {
            text-align: center !important;
          }
          .response-button {
            width: 90% !important;
            max-width: 280px !important;
            display: block !important;
            margin: 0 auto !important;
            box-sizing: border-box !important;
          }
          .mobile-text {
            font-size: 14px !important;
            line-height: 1.4 !important;
          }
          .mobile-list-item {
            margin-bottom: 12px !important;
            font-size: 14px !important;
          }
          .mobile-title {
            font-size: 16px !important;
            margin-bottom: 15px !important;
          }
        }
        @media only screen and (max-width: 480px) {
          .content-block {
            padding: 12px 12px !important;
          }
          .mobile-text {
            font-size: 13px !important;
          }
          .mobile-list-item {
            font-size: 13px !important;
          }
        }
      </style>
      
      <div class="email-container">
        <p class="mobile-text">Hi ${recipientName},</p>
        <p class="mobile-text" style="margin-top: 10px;">${introMessage}</p>
        
        <ul class="content-block" style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px; list-style: none; margin-left: 0; padding-left: 20px; padding-right: 20px;">
          <p class="mobile-title" style="margin: 0 0 10px 0;"><strong>Negotiation:</strong></p>
          <li class="mobile-list-item" style="margin-bottom: 8px; word-wrap: break-word;"><strong>${recipientType === "buyer" ? "Your" : "Seller's"} Offer:</strong> ${formatPrice(sellerCounterOffer) || "N/A"}</li>
        </ul>
        
        ${inspectionDetailsHtml}
        
        <ul class="content-block" style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px; list-style: none; margin-left: 0; padding-left: 20px; padding-right: 20px;">
          <p class="mobile-title" style="margin: 0 0 10px 0;"><strong>Property Details:</strong></p>
          <li class="mobile-list-item" style="margin-bottom: 8px; word-wrap: break-word;"><strong>Property Type:</strong> ${propertyType || "N/A"}</li>
          <li class="mobile-list-item" style="margin-bottom: 8px; word-wrap: break-word;"><strong>Location:</strong> ${location || "N/A"}</li>
          <li class="mobile-list-item" style="margin-bottom: 8px; word-wrap: break-word;"><strong>Original Price:</strong> ${formatPrice(price) || "N/A"}</li>
        </ul>
        
        ${!isInitiator ? `
        <p class="mobile-text" style="margin-top: 15px;">Please respond to this counter-offer:</p>
        <div class="button-container" style="margin-top: 20px;">
          <a href="${payload.responseLink}" class="response-button" style="display: inline-block; width: 120px; height: 40px; background-color: #1A7F64; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-right: 10px;">
            Click to respond
          </a>
        </div>
        <p class="mobile-text" style="margin-top: 15px;">Thanks for your flexibility!</p>
        ` : `
        <p class="mobile-text" style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>
        `}
      </div>
    </div>`;
}

/**
 * 
 * @param recipientName 
 * @param payload 
 * @param isInitiator 
 * @param recipientType 
 * @returns 
 */
function InspectionAcceptedTemplate(
  recipientName: string,
  payload: any,
  isInitiator: boolean,
  recipientType: "buyer" | "seller"
): string {
  const {
    location,
    price,
    propertyType,
    inspectionDateTime,
    inspectionMode,
    modeChanged,
    responseLink,
  } = payload;

  const inspectionDate = inspectionDateTime?.newDateTime?.newDate;
  const inspectionTime = inspectionDateTime?.newDateTime?.newTime;
  const dateTimeChanged = inspectionDateTime?.dateTimeChanged;
  const inspectionDetailsBgColor = "#EEF7FF";

  let introMessage = "";
  let confirmedDateTimeHtml = "";
  let inspectionModeHtml = "";

  if (isInitiator) {
    introMessage = `You have successfully <span style="color: #1AAD1F;">accepted</span> the inspection request for ${location}.`;
  } else {
    introMessage = `Good news! The ${recipientType === "buyer" ? "seller" : "buyer"} has <span style="color: #1AAD1F;">accepted</span> your inspection request for ${location}.`;

    if (dateTimeChanged) {
      introMessage += ` The originally requested date was unavailable, and a <strong style="color: #1AAD1F;">new date and time have been confirmed</strong>.`;

      confirmedDateTimeHtml = `
        <ul style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p><strong>Updated Inspection Schedule:</strong></p>
          <li><strong>Original Date:</strong> ${inspectionDateTime?.oldDateTime?.newDate || "N/A"}</li>
          <li><strong>Original Time:</strong> ${inspectionDateTime?.oldDateTime?.oldTime || "N/A"}</li>
          <li style="margin-top: 10px; color: #1AAD1F;"><strong>New Confirmed Date:</strong> ${inspectionDate || "N/A"}</li>
          <li style="color: #1AAD1F;"><strong>New Confirmed Time:</strong> ${inspectionTime || "N/A"}</li>
        </ul>`;
    } else {
      introMessage += ` The inspection date and time have been confirmed.`;

      confirmedDateTimeHtml = `
        <ul style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
          <p><strong>Confirmed Date & Time:</strong></p>
          <li><strong>Date:</strong> ${inspectionDate || "N/A"} <span style="color: #34A853;">(Unchanged from original request)</span></li>
          <li><strong>Time:</strong> ${inspectionTime || "N/A"} <span style="color: #34A853;">(Unchanged from original request)</span></li>
        </ul>`;
    }
  }

  if (inspectionMode) {
    const modeLabel = getInspectionModeInfo(inspectionMode);

    inspectionModeHtml = `
      <ul style="background-color: ${inspectionDetailsBgColor}; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p><strong>Inspection Mode:</strong></p>
        <li><strong>Mode:</strong> ${modeLabel.label}</li>
        ${modeChanged ? `<li style="color: #1AAD1F;"><strong>Status:</strong> Changed from previously requested mode</li>` : ""}
      </ul>`;
  }

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: Arial, sans-serif;
        }
        .container {
          max-width: 600px;
          margin: auto;
          padding: 20px;
          word-break: break-word;
        }
        ul {
          list-style-type: none;
          padding-left: 0;
        }
        a.button {
          display: inline-block;
          width: 100%;
          max-width: 180px;
          height: 40px;
          text-align: center;
          line-height: 40px;
          border-radius: 6px;
          text-decoration: none;
          font-weight: bold;
        }
        @media screen and (max-width: 600px) {
          .container {
            padding: 10px;
          }
          a.button {
            width: 100% !important;
            margin-bottom: 10px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <p>Hi ${recipientName},</p>
        <p style="margin-top: 10px;">${introMessage}</p>
        ${confirmedDateTimeHtml}
        ${inspectionModeHtml}
        <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px;">
          <p><strong>Property Details:</strong></p>
          <li><strong>Property Type:</strong> ${propertyType || "N/A"}</li>
          <li><strong>Location:</strong> ${location || "N/A"}</li>
          <li><strong>Price:</strong> ${formatPrice(price) || "N/A"}</li>
        </ul>
        ${
          !isInitiator
            ? `
        <p style="margin-top: 15px;">You'll receive a reminder before the inspection. If you have any questions, feel free to reach out.</p>
        <p style="margin-top: 15px;">We look forward to seeing you then. If you need to reschedule, please let us know.</p>
        <div style="margin-top: 20px;">
          <a href="${responseLink}" class="button" style="background-color: #1A7F64; color: #fff; margin-right: 10px;">
            View Details
          </a>
          <a href="${responseLink}" class="button" style="background-color: #6C757D; color: #fff;">
            Reschedule
          </a>
        </div>`
            : `
        <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`
        }
      </div>
    </body>
  </html>
  `;
}


 

/**
 * LOI-specific templates (unchanged)
 * 
 * @param buyerName 
 * @param propertyData 
 * @param isInitiator 
 * @returns 
 */
function LOINegotiationAcceptedTemplate(
  buyerName: string,
  propertyData: any,
  isInitiator: boolean = false
): string {
  const {
    location,
    propertyType,
    price,
    responseLink,
    inspectionDateTime,
    inspectionMode,
    modeChanged,
  } = propertyData;

  const dateTimeChanged = inspectionDateTime?.dateTimeChanged;
  const inspectionDate = inspectionDateTime?.newDateTime?.newDate;
  const inspectionTime = inspectionDateTime?.newDateTime?.newTime;
  const oldDate = inspectionDateTime?.oldDateTime?.newDate;
  const oldTime = inspectionDateTime?.oldDateTime?.oldTime;

  const introMessage = isInitiator
    ? `You have successfully <span style="color: #1AAD1F;">accepted</span> the buyer's Letter of Intent (LOI) for the property at ${location}.`
    : `Great news! The seller has <span style="color: #1AAD1F;">accepted</span> your Letter of Intent (LOI)${
        dateTimeChanged || modeChanged
          ? " and <strong style='color: #1AAD1F;'>updated the inspection schedule</strong>"
          : ""
      } for the property at ${location}.`;

  const loiStatusHtml = `
    <ul style="background-color: #E4EFE7; padding: 25px 20px; border-radius: 10px; margin-top: 15px;">
      <p style="color: #34A853;"><strong>LOI Accepted:</strong></p>
      <li><strong>LOI Status:</strong> Accepted</li>
    </ul>`;

  const inspectionDateHtml = dateTimeChanged
    ? `
      <li><strong>Original Date:</strong> ${oldDate || "N/A"}</li>
      <li><strong>Original Time:</strong> ${oldTime || "N/A"}</li>
      <li style="margin-top: 10px; color: #1976D2;"><strong>New Date:</strong> ${inspectionDate || "N/A"}</li>
      <li style="color: #1976D2;"><strong>New Time:</strong> ${inspectionTime || "N/A"}</li>`
    : `
      <li><strong>Date:</strong> ${inspectionDate || "N/A"} ${inspectionTime || ""} <span style="color: #34A853;">(Confirmed)</span></li>`;

  const inspectionModeHtml = modeChanged
    ? `
      <li><strong>Previous Mode:</strong> ${propertyData.inspectionDateTime?.oldDateTime?.mode || "N/A"}</li>
      <li style="color: #1976D2;"><strong>New Mode:</strong> ${inspectionMode || "N/A"}</li>`
    : `
      <li><strong>Mode:</strong> ${inspectionMode || "N/A"} <span style="color: #34A853;">(Confirmed)</span></li>`;

  const inspectionDetailsHtml = `
    <ul style="background-color: ${dateTimeChanged || modeChanged ? "#EEF7FF" : "#FAFAFA"}; padding: 25px 20px; border-radius: 10px; margin-top: 15px;">
      <p><strong>${dateTimeChanged || modeChanged ? "Updated" : "Confirmed"} Inspection Details:</strong></p>
      ${inspectionDateHtml}
      ${inspectionModeHtml}
    </ul>`;

  const propertyDetailsHtml = `
    <ul style="background-color: #E4EFE7; padding: 25px 20px; border-radius: 10px; margin-top: 15px;">
      <p><strong>Property Details:</strong></p>
      <li><strong>Property Type:</strong> ${propertyType || "N/A"}</li>
      <li><strong>Location:</strong> ${location || "N/A"}</li>
      <li><strong>Original Price:</strong> ${formatPrice(price) || "N/A"}</li>
    </ul>`;

  const additionalNote = isInitiator
    ? `<p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`
    : `
      <p style="margin-top: 15px;">Our team will follow up with you shortly to ensure a smooth inspection process.</p>
      <p style="margin-top: 15px;">Thank you for using Khabi-Teq Realty. We're committed to helping you close your deal faster.</p>
      <p style="margin-top: 15px;">You'll receive a reminder before the inspection. If you have any questions, feel free to reach out.</p>
      <p style="margin-top: 15px;">We look forward to seeing you then. If you need to reschedule, please let us know.</p>`;

  const actionButtons = !isInitiator
    ? `
      <div style="margin-top: 20px;">
        <a href="${responseLink}" style="display: inline-block; width: 100%; max-width: 220px; height: 40px; background-color: #1A7F64; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold;">
          View Details
        </a>
      </div>`
    : "";

  return `
    <style>
      @media only screen and (max-width: 600px) {
        ul {
          padding: 20px 15px !important;
        }
        a {
          width: 100% !important;
          display: block !important;
          margin-bottom: 10px !important;
        }
        li {
          font-size: 14px !important;
        }
        p {
          font-size: 15px !important;
        }
      }
    </style>

    <div style="max-width: 600px; width: 100%; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif; box-sizing: border-box;">
      <p>Dear ${buyerName},</p>
      <p style="margin-top: 10px;">${introMessage}</p>
      ${loiStatusHtml}
      ${inspectionDetailsHtml}
      ${propertyDetailsHtml}
      ${additionalNote}
      ${actionButtons}
    </div>`;
}


/**
 * 
 * LOI REQUEST CHANGES TEMPLATE
 * 
 * @param recipientName 
 * @param propertyData 
 * @param isInitiator 
 * @returns 
 */
function LOIRequestChangesTemplate(
  recipientName: string,
  propertyData: any,
  isInitiator: boolean = false
): string {
  const {
    location,
    reason,
    propertyType,
    price,
    inspectionDateTime,
    responseLink,
  } = propertyData;

  const dateTimeChanged = inspectionDateTime?.dateTimeChanged;
  const inspectionDate = inspectionDateTime?.newDateTime?.newDate;
  const inspectionTime = inspectionDateTime?.newDateTime?.newTime;
  const oldDate = inspectionDateTime?.oldDateTime?.newDate;
  const oldTime = inspectionDateTime?.oldDateTime?.oldTime;

  let introMessage = "";
  let reasonHtml = "";
  let inspectionDetailsHtml = "";
  let actionButtons = "";

  if (isInitiator) {
    introMessage = `You have successfully <span style="color: #1976D2;">requested changes</span> to the buyer's LOI document for the property at ${location}.`;

    if (dateTimeChanged) {
      introMessage += ` You also <strong style="color: #34A853;">updated the inspection schedule</strong>.`;
    }
  } else {
    introMessage = `The seller has <span style="color: #1976D2;">requested changes</span> to your LOI document for the property at ${location}.`;

    if (dateTimeChanged) {
      introMessage += ` They also <strong style="color: #34A853;">proposed new inspection date/time details</strong>.`;
    }
  }

  reasonHtml = `
    <ul style="background-color: #FFF3CD; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
      <p style="color: #856404;"><strong>Request Details:</strong></p>
      <li><strong>Reason for Changes:</strong> ${reason || "N/A"}</li>
    </ul>`;

  if (dateTimeChanged) {
    inspectionDetailsHtml = `
      <ul style="background-color: #EEF7FF; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p><strong>Updated Inspection Details:</strong></p>
        <li><strong>Original Date:</strong> ${oldDate || "N/A"}</li>
        <li><strong>Original Time:</strong> ${oldTime || "N/A"}</li>
        <li style="margin-top: 10px; color: #1976D2;"><strong>New Date:</strong> ${inspectionDate || "N/A"}</li>
        <li style="color: #1976D2;"><strong>New Time:</strong> ${inspectionTime || "N/A"}</li>
      </ul>`;
  } else {
    inspectionDetailsHtml = `
      <ul style="background-color: #FAFAFA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p><strong>Inspection Details:</strong></p>
        <li><strong>Date:</strong> ${inspectionDate || "N/A"} <span style="color: #34A853;">(Unchanged)</span></li>
        <li><strong>Time:</strong> ${inspectionTime || "N/A"} <span style="color: #34A853;">(Unchanged)</span></li>
      </ul>`;
  }

  if (!isInitiator) {
    actionButtons = `
      <p style="margin-top: 15px;">Please review the requested changes and update your LOI document accordingly.</p>
      <div style="margin-top: 20px;">
        <a href="${responseLink}" style="display: inline-block; width: 180px; height: 40px; background-color: #1A7F64; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-right: 10px;">
          Resubmit LOI Document
        </a>
        <a href="${responseLink}" style="display: inline-block; width: 140px; height: 40px; background-color: #6C757D; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold;">
          View Details
        </a>
      </div>`;
  }

  const propertyDetailsHtml = `
    <ul style="background-color: #E4EFE7; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
      <p><strong>Property Details:</strong></p>
      <li><strong>Property Type:</strong> ${propertyType || "N/A"}</li>
      <li><strong>Location:</strong> ${location || "N/A"}</li>
      <li><strong>Original Price:</strong> ${formatPrice(price) || "N/A"}</li>
    </ul>`;

  return `
    <p>Hi ${recipientName},</p>
    <p style="margin-top: 10px;">${introMessage}</p>
    ${reasonHtml}
    ${inspectionDetailsHtml}
    ${propertyDetailsHtml}
    ${actionButtons}
    <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>`;
}


/**
 * LOI COUNTER MAIL TEMPLATE 
 * 
 * @param recipientName 
 * @param propertyData 
 * @param isInitiator 
 * @returns 
 */
function LOICounterTemplate(
  recipientName: string,
  propertyData: any,
  isInitiator: boolean = false
): string {
  const {
    location,
    price,
    responseLink,
    propertyType,
    inspectionDateTime,
    modeChanged,
    inspectionMode
  } = propertyData;

  const dateTimeChanged = inspectionDateTime?.dateTimeChanged;

  const inspectionDate = inspectionDateTime?.newDateTime?.newDate;
  const inspectionTime = inspectionDateTime?.newDateTime?.newTime;
  const oldDate = inspectionDateTime?.oldDateTime?.newDate;
  const oldTime = inspectionDateTime?.oldDateTime?.oldTime;

  const modeInfo = getInspectionModeInfo(inspectionMode);

  let introMessage = "";
  let inspectionDetailsHtml = "";
  let negotiationDetailsHtml = "";

  if (isInitiator) {
    introMessage = `You have successfully <span style="color: #1AAD1F;">responded</span> to the seller's request changes on your previous LOI document for the property at ${location}.`;
  } else {
    introMessage = `The buyer has re-uploaded the LOI document in respond to your <span style="color: #1976D2;">request-changes</span>.`;
  }

  if (dateTimeChanged || modeChanged) {
    introMessage += ` ${isInitiator ? "You've" : "They have"} also <strong style="color: #34A853;">proposed new inspection details</strong>.`;

    inspectionDetailsHtml = `
      <ul style="background-color: #EEF7FF; padding: 25px 20px; border-radius: 10px; margin-top: 15px; list-style: none; width: 100%; max-width: 100%; box-sizing: border-box;">
        <p style="margin: 0 0 10px 0;"><strong>Updated Inspection Details:</strong></p>
        <li><strong>Original Date:</strong> ${oldDate || "N/A"}</li>
        <li><strong>Original Time:</strong> ${oldTime || "N/A"}</li>
        ${modeChanged ? `<li><strong>Original Mode:</strong> ${modeInfo.label}</li>` : ""}
        <li style="margin-top: 10px; color: #1976D2;"><strong>New Date:</strong> ${inspectionDate || "N/A"}</li>
        <li style="color: #1976D2;"><strong>New Time:</strong> ${inspectionTime || "N/A"}</li>
        ${modeChanged ? `<li style="color: #1976D2;"><strong>New Mode:</strong> ${modeInfo.inverse}</li>` : ""}
      </ul>`;
  } else {
    introMessage += ` ${isInitiator ? "You've accepted the initial inspection details" : "The inspection date/time and mode have also been approved"}.`;

    inspectionDetailsHtml = `
      <ul style="background-color: #EEF7FF; padding: 25px 20px; border-radius: 10px; margin-top: 15px; list-style: none; width: 100%; max-width: 100%; box-sizing: border-box;">
        <p style="margin: 0 0 10px 0;"><strong>Inspection Details:</strong></p>
        <li><strong>Date:</strong> ${inspectionDate || "N/A"} <span style="color: #34A853;">(Confirmed)</span></li>
        <li><strong>Time:</strong> ${inspectionTime || "N/A"} <span style="color: #34A853;">(Confirmed)</span></li>
        <li><strong>Mode:</strong> ${modeInfo.label || "N/A"} <span style="color: #34A853;">(Confirmed)</span></li>
      </ul>`;
  }

  return `
  <div style="width: 100%; max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; box-sizing: border-box; padding: 0 15px;">
    <p style="margin-top: 0;">Hi ${recipientName},</p>
    <p style="margin-top: 10px;">${introMessage}</p>

    ${inspectionDetailsHtml}

    <ul style="background-color: #E4EFE7; padding: 25px 20px; border-radius: 10px; list-style: none; width: 100%; max-width: 100%; box-sizing: border-box;">
      <p style="margin: 0 0 10px 0;"><strong>Property Details:</strong></p>
      <li><strong>Property Type:</strong> ${propertyType || "N/A"}</li>
      <li><strong>Location:</strong> ${location || "N/A"}</li>
      <li><strong>Original Price:</strong> ${formatPrice(price) || "N/A"}</li>
    </ul>

    ${!isInitiator ? `
      <p style="margin-top: 15px;">Please review the counter-offer and respond accordingly.</p>
      <div style="margin-top: 20px;">
        <a href="${responseLink}" style="display: inline-block; width: 100%; max-width: 160px; height: 40px; background-color: #1A7F64; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold;">
          View LOI
        </a>
      </div>
      <p style="margin-top: 15px;">If you have any questions about the counter-offer, feel free to reach out.</p>
    ` : `
      <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>
    `}
  </div>`;
}



/**
 * LOI REJECT TEMPLATE
 */
function LOIRejectTemplate(
  recipientName: string,
  propertyData: any,
  isInitiator: boolean = false
): string {
  const {
    location,
    price,
    propertyType,
    rejectionReason,
    inspectionDateTime,
    inspectionMode,
    modeChanged,
  } = propertyData;

  const dateTimeChanged = inspectionDateTime?.dateTimeChanged ?? false;
  const inspectionDate = inspectionDateTime?.newDateTime?.newDate || null;
  const inspectionTime = inspectionDateTime?.newDateTime?.newTime || null;
  const oldDate = inspectionDateTime?.oldDateTime?.oldDate || null;
  const oldTime = inspectionDateTime?.oldDateTime?.oldTime || null;

  let introMessage = "";
  let inspectionDetailsHtml = "";
  let rejectionDetailsHtml = "";

  if (isInitiator) {
    introMessage = `You have <span style="color: #FF2539;">rejected</span> the buyer's LOI for the property at ${location}.`;

    rejectionDetailsHtml = `
      <ul style="background-color: #FFF3CD; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p style="color: #856404;"><strong>Rejection Details:</strong></p>
        <li><strong>Reason for Rejection:</strong> ${rejectionReason || "N/A"}</li>
      </ul>`;
  } else {
    introMessage = `The buyer's LOI has been rejected for the property at ${location}.`;

    rejectionDetailsHtml = `
      <ul style="background-color: #FFF3CD; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p style="color: #856404;"><strong>Rejection Details:</strong></p>
        <li><strong>Reason for Rejection:</strong> ${rejectionReason || "N/A"}</li>
      </ul>`;
  }

  if (dateTimeChanged || modeChanged) {
    const modeLabel = getInspectionModeInfo(inspectionMode);
    inspectionDetailsHtml = `
      <ul style="background-color: #E0F7FA; padding: 25px 20px; gap: 10px; border-radius: 10px; margin-top: 15px;">
        <p style="color: #007B8F;"><strong>Updated Inspection Details:</strong></p>
        ${dateTimeChanged ? `
          ${oldDate ? `<li><strong>Previous Date:</strong> ${oldDate}</li>` : ""}
          ${oldTime ? `<li><strong>Previous Time:</strong> ${oldTime}</li>` : ""}
          ${inspectionDate ? `<li><strong>New Date:</strong> ${inspectionDate}</li>` : ""}
          ${inspectionTime ? `<li><strong>New Time:</strong> ${inspectionTime}</li>` : ""}
        ` : ""}
        ${modeChanged ? `
          <li><strong>Previous Inspection Mode:</strong> ${modeLabel.inverse || "N/A"}</li>
          <li><strong>New Inspection Mode:</strong> ${modeLabel.label || "N/A"}</li>
        ` : ""}
      </ul>`;
  }

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <style>
        @media only screen and (max-width: 600px) {
          ul {
            padding: 15px !important;
          }
          li {
            font-size: 14px !important;
          }
          a {
            width: 100% !important;
            margin-bottom: 10px !important;
          }
          p {
            font-size: 15px !important;
          }
        }
      </style>
    </head>
    <body style="font-family: Arial, sans-serif; color: #212529; line-height: 1.5;">
      <p>Dear ${recipientName},</p>
      <p style="margin-top: 10px;">${introMessage}</p>
      ${inspectionDetailsHtml}
      ${rejectionDetailsHtml}
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
        <a href="${propertyData.responseLink}" style="display: inline-block; width: 162px; height: 40px; background-color: #1A7F64; color: #fff; text-align: center; line-height: 40px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-right: 10px;">
          View Details
        </a>
      </div>
      ` : `
      <p style="margin-top: 15px;">If you have any questions, feel free to contact us.</p>
      `}
    </body>
  </html>
  `;
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
  isInitiator?: boolean;
}

interface EmailTemplate {
  html: string;
  text: string;
  subject: string;
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
  const location = payload.propertyAddress || payload.location || 'Property'; // Adjust based on your payload structure

  if (isLOI) {
    switch (action) {
      case "accept":
        return {
          html: LOINegotiationAcceptedTemplate(buyerName, payload, isInitiator),
          text: "",
          subject: generateAcceptSubject(recipientType, isInitiator, location, isLOI),
        };
      case "reject":
        return {
          html: LOIRejectTemplate(recipientName, payload, isInitiator),
          text: "",
          subject: generateRejectSubject(recipientType, isInitiator, location, isLOI),
        };
      case "counter":
        return {
          html: LOICounterTemplate(recipientName, payload, isInitiator),
          text: "",
          subject: generateCounterSubject(recipientType, isInitiator, location, isLOI),
        };
      case "request_changes":
        return {
          html: LOIRequestChangesTemplate(recipientName, payload, isInitiator),
          text: "",
          subject: generateRequestChangesSubject(recipientType, isInitiator, location, isLOI),
        };
      default:
        throw new Error(`Unsupported LOI action: ${action}`);
    }
  }

  switch (action) {
    case "reject":
      return {
        html: RejectTemplate(recipientName, payload, isInitiator, recipientType),
        text: "",
        subject: generateRejectSubject(recipientType, isInitiator, location, isLOI),
      };
    case "counter":
      return {
        html: CounterTemplate(recipientName, payload, isInitiator, recipientType),
        text: "",
        subject: generateCounterSubject(recipientType, isInitiator, location, isLOI),
      };
    case "accept":
      return {
        html: InspectionAcceptedTemplate(recipientName, payload, isInitiator, recipientType),
        text: "",
        subject: generateAcceptSubject(recipientType, isInitiator, location, isLOI),
      };
    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}
