
export interface NewInspectionRequest {
  briefType: string;
  properties: {
    propertyId: string;
    negotiationPrice?: number;
    letterOfIntention?: string;
  }[];
  inspectionDate: string;
  inspectionTime: string;
  requestedBy: {
    fullName: string;
    email: string;
    phoneNumber: string;
  };
  transaction: {
    fullName: string;
    transactionReceipt: string;
  };
}


// Type definitions for inspection actions
export interface InspectionActionData {
  action: "accept" | "reject" | "counter" | "request_changes";
  inspectionType: "price" | "LOI";
  userType: "buyer" | "seller";
  counterPrice?: number;
  inspectionDate?: string;
  inspectionTime?: string;
  reason?: string;
  rejectionReason?: string;
  documentUrl?: string;
}

export interface SubmitInspectionPayload {
  inspectionType: "price" | "LOI";
  inspectionDate: string;
  inspectionTime: string;
  requestedBy: {
    fullName: string;
    email: string;
    phoneNumber: string;
  };
  transaction: {
    fullName: string;
    transactionReceipt: string;
  };
  properties: Array<{
    propertyId: string;
    negotiationPrice?: number;
    letterOfIntention?: string;
  }>;
}

// Type definitions for update objects
interface BaseUpdateData {
  inspectionType: "price" | "LOI";
  isLOI: boolean;
  inspectionDate?: string;
  inspectionTime?: string;
}

export interface AcceptUpdateData extends BaseUpdateData {
  status: "negotiation_accepted";
  inspectionStatus: "accepted";
  isNegotiating: false;
  stage: "inspection" | "completed";
  pendingResponseFrom?: undefined;
}

export interface RejectUpdateData extends BaseUpdateData {
  status: "negotiation_rejected";
  inspectionStatus: "rejected";
  isNegotiating: false;
  stage: "cancelled";
  reason?: string;
  pendingResponseFrom?: undefined;
}

export interface CounterUpdateData extends BaseUpdateData {
  status: "negotiation_countered";
  inspectionStatus: "countered";
  isNegotiating: true;
  pendingResponseFrom: "buyer" | "seller";
  stage: "negotiation";
  negotiationPrice?: number;
  letterOfIntention?: string;
}

export interface RequestChangesUpdateData extends BaseUpdateData {
  status: "negotiation_countered";
  inspectionStatus: "requested_changes";
  reason?: string;
  isNegotiating: false;
  stage: "negotiation";
  pendingResponseFrom: "buyer";
}

export type UpdateData = AcceptUpdateData | RejectUpdateData | CounterUpdateData | RequestChangesUpdateData;

export interface EmailData {
  propertyType?: string;
  location?: string;
  price?: number;
  negotiationPrice?: number;
  sellerCounterOffer?: number;
  documentUrl?: string;
  reason?: string;
  inspectionDateStatus?: string;
  inspectionDateTime?: {
    dateTimeChanged: boolean;
    newDateTime: {
      newDate: string;
      newTime: string;
    };
    oldDateTime?: {
      newDate: string;
      oldTime: string;
    };
  };
  checkLink?: string;
  rejectLink?: string;
  browseLink?: string;
  buyerResponseLink?: string;
}

export interface ActionResult {
  update: UpdateData;
  logMessage: string;
  emailSubject: string;
  emailData: EmailData;
}

export interface InspectionLinks {
  sellerResponseLink: string;
  buyerResponseLink: string;
  negotiationResponseLink: string;
  checkLink: string;
  browseLink: string;
  rejectLink: string;
}