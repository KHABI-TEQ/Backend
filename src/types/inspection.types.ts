// Type definitions for inspection actions
export interface InspectionActionData {
  action: "accept" | "reject" | "counter";
  inspectionType: "price" | "LOI";
  userType: "buyer" | "seller";
  counterPrice?: number;
  inspectionDate?: string;
  inspectionTime?: string;
  rejectionReason?: string;
  inspectionMode?: "in_person" | "virtual";
}

export interface RequestedBy {
  fullName: string;
  phoneNumber: string;
  email: string;
}

export interface InspectionDetails {
  inspectionDate: string;
  inspectionTime: string;
  inspectionMode?: "in_person" | "virtual";
}

export interface Transaction {
  amount: number;
}

export interface PropertyPayload {
  propertyId: string;
  inspectionType: "price" | "LOI";
  negotiationPrice?: number;
  letterOfIntention?: string;
}

export interface SubmitInspectionPayload {
  requestedBy: RequestedBy;
  inspectionDetails: InspectionDetails;
  inspectionAmount: number;
  properties: PropertyPayload[];
}

// Type definitions for update objects
interface BaseUpdateData {
  inspectionType: "price" | "LOI";
  isLOI: boolean;
  inspectionDate?: string;
  inspectionTime?: string;
  inspectionMode?: "in_person" | "virtual";
  stage: "inspection" | "completed" | "cancelled" | "negotiation";
  inspectionStatus: "accepted" | "countered";
  pendingResponseFrom: "buyer" | "seller";
}

export interface AcceptUpdateData extends BaseUpdateData {
  status: "negotiation_accepted";
  isNegotiating: false;
}

export interface RejectUpdateData extends BaseUpdateData {
  status: "negotiation_rejected";
  isNegotiating: false;
  reason?: string;
}

export interface CounterUpdateData extends BaseUpdateData {
  status: "negotiation_countered";
  isNegotiating: true;
  negotiationPrice?: number;
  letterOfIntention?: string;
  counterCount?: number;
}

export type UpdateData =
  | AcceptUpdateData
  | RejectUpdateData
  | CounterUpdateData;

export interface EmailData {
  propertyType?: string;
  location?: string;
  price?: number;
  negotiationPrice?: number;
  sellerCounterOffer?: number;
  reason?: string;
  inspectionDateStatus?: string;
  inspectionMode?: string;
  modeChanged?: boolean;
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
  responseLink?: string;
  counterCount?: number;
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
