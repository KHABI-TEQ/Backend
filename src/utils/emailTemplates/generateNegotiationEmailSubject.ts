export interface EmailSubjectParams {
  userType: "seller" | "buyer";
  action: "accept" | "reject" | "counter" | "request_changes";
  buyerName: string;
  sellerName: string;
  recipientType: "buyer" | "seller";
  payload: any;
  isLOI: boolean;
  isInitiator?: boolean;
}

/**
 * Generates dynamic email subjects for negotiation templates
 * @param params - Email subject parameters
 * @returns Formatted email subject string
 */
export function generateNegotiationEmailSubject(
  params: EmailSubjectParams
): string {
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

  const { location, propertyType } = payload;
  const recipientName = recipientType === "buyer" ? buyerName : sellerName;
  const otherParty = recipientType === "buyer" ? "Seller" : "Buyer";
  
  // Truncate location if too long for subject line
  const shortLocation = location && location.length > 30 
    ? `${location.substring(0, 30)}...` 
    : location || "Property";

  if (isLOI) {
    switch (action) {
      case "accept":
        return isInitiator
          ? `✅ LOI Accepted - ${shortLocation}`
          : `🎉 Great News! Your LOI has been Accepted - ${shortLocation}`;
      
      case "reject":
        return isInitiator
          ? `❌ LOI Rejected - ${shortLocation}`
          : `❌ LOI Rejected - ${shortLocation}`;
      
      case "counter":
        return isInitiator
          ? `📝 LOI Document Updated - ${shortLocation}`
          : `📝 Updated LOI Document Submitted - ${shortLocation}`;
      
      case "request_changes":
        return isInitiator
          ? `📋 LOI Changes Requested - ${shortLocation}`
          : `📋 Changes Requested for Your LOI - ${shortLocation}`;
      
      default:
        return `📄 LOI Update - ${shortLocation}`;
    }
  }

  // Regular negotiation subjects
  switch (action) {
    case "reject":
      return isInitiator
        ? `❌ Offer Rejected - ${shortLocation}`
        : `❌ Your Offer has been Rejected - ${shortLocation}`;
    
    case "counter":
      return isInitiator
        ? `💰 Counter Offer Sent - ${shortLocation}`
        : `💰 New Counter Offer Received - ${shortLocation}`;
    
    case "accept":
      const dateTimeChanged = payload.inspectionDateTime?.dateTimeChanged;
      if (dateTimeChanged) {
        return isInitiator
          ? `✅ Inspection Accepted with New Schedule - ${shortLocation}`
          : `🎉 Inspection Accepted! Updated Schedule - ${shortLocation}`;
      }
      return isInitiator
        ? `✅ Inspection Request Accepted - ${shortLocation}`
        : `🎉 Great News! Inspection Confirmed - ${shortLocation}`;
    
    default:
      return `🏠 Property Update - ${shortLocation}`;
  }
}

/**
 * Alternative subject generator with more business-focused tone
 * @param params - Email subject parameters
 * @returns Professional email subject string
 */
export function generateProfessionalEmailSubject(
  params: EmailSubjectParams
): string {
  const {
    action,
    payload,
    isLOI,
    isInitiator = false,
  } = params;

  const { location, propertyType } = payload;
  const shortLocation = location && location.length > 25 
    ? `${location.substring(0, 25)}...` 
    : location || "Property";

  if (isLOI) {
    switch (action) {
      case "accept":
        return `LOI Accepted - ${shortLocation}`;
      
      case "reject":
        return `LOI Status Update - ${shortLocation}`;
      
      case "counter":
        return `LOI Document Resubmitted - ${shortLocation}`;
      
      case "request_changes":
        return `LOI Review Required - ${shortLocation}`;
      
      default:
        return `LOI Update - ${shortLocation}`;
    }
  }

  switch (action) {
    case "reject":
      return `Offer Status Update - ${shortLocation}`;
    
    case "counter":
      return `Counter Offer - ${shortLocation}`;
    
    case "accept":
      const dateTimeChanged = payload.inspectionDateTime?.dateTimeChanged;
      return dateTimeChanged
        ? `Inspection Scheduled (Updated) - ${shortLocation}`
        : `Inspection Confirmed - ${shortLocation}`;
    
    default:
      return `Property Negotiation Update - ${shortLocation}`;
  }
}

/**
 * Generates subject with property type emphasis
 * @param params - Email subject parameters
 * @returns Subject string with property type
 */
export function generatePropertyFocusedSubject(
  params: EmailSubjectParams
): string {
  const {
    action,
    payload,
    isLOI,
    recipientType,
    isInitiator = false,
  } = params;

  const { location, propertyType } = payload;
  const propertyDesc = propertyType ? `${propertyType} at ${location}` : location;
  const shortPropertyDesc = propertyDesc && propertyDesc.length > 35 
    ? `${propertyDesc.substring(0, 35)}...` 
    : propertyDesc || "Property";

  if (isLOI) {
    switch (action) {
      case "accept":
        return isInitiator
          ? `LOI Accepted for ${shortPropertyDesc}`
          : `Your LOI Accepted - ${shortPropertyDesc}`;
      
      case "reject":
        return `LOI Rejected - ${shortPropertyDesc}`;
      
      case "counter":
        return `LOI Updated - ${shortPropertyDesc}`;
      
      case "request_changes":
        return `LOI Changes Needed - ${shortPropertyDesc}`;
      
      default:
        return `LOI Update - ${shortPropertyDesc}`;
    }
  }

  switch (action) {
    case "reject":
      return `Offer Rejected - ${shortPropertyDesc}`;
    
    case "counter":
      return `Counter Offer - ${shortPropertyDesc}`;
    
    case "accept":
      return `Inspection Confirmed - ${shortPropertyDesc}`;
    
    default:
      return `Update - ${shortPropertyDesc}`;
  }
}

/**
 * Main subject generator with fallback options
 * @param params - Email subject parameters
 * @param style - Subject style preference
 * @returns Email subject string
 */
export function generateEmailSubject(
  params: EmailSubjectParams,
  style: "friendly" | "professional" | "property-focused" = "friendly"
): string {
  try {
    switch (style) {
      case "professional":
        return generateProfessionalEmailSubject(params);
      case "property-focused":
        return generatePropertyFocusedSubject(params);
      case "friendly":
      default:
        return generateNegotiationEmailSubject(params);
    }
  } catch (error) {
    console.error("Error generating email subject:", error);
    // Fallback subject
    const { payload, action, isLOI } = params;
    const location = payload.location;

    const shortLocation = location && location.length > 30 
      ? `${location.substring(0, 30)}...` 
      : location || "Property";
    
    if (isLOI) {
      return `LOI Update - ${shortLocation}`;
    }
    
    switch (action) {
      case "accept":
        return `Inspection Update - ${shortLocation}`;
      case "reject":
        return `Offer Update - ${shortLocation}`;
      case "counter":
        return `Counter Offer - ${shortLocation}`;
      default:
        return `Property Update - ${shortLocation}`;
    }
  }
}