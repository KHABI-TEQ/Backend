
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