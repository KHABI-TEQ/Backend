/** Canonical preference types aligned with backend Joi (`preference.validator.ts`). */

export type PreferenceType = "buy" | "rent" | "joint-venture" | "shortlet" | "off-plan";

export type PreferenceMode = "buy" | "tenant" | "developer" | "shortlet";

export type JvDevelopmentType = "residential" | "commercial" | "mixed-use" | "industrial";

export type JvTitleRequirement =
  | "certificate-of-occupancy"
  | "governors-consent"
  | "survey-plan"
  | "deed-of-assignment"
  | "excision"
  | "gazette"
  | "family-receipt";

/** Backend `developmentDetails` shape (joint venture). */
export interface DevelopmentDetailsPayload {
  minLandSize?: string;
  maxLandSize?: string;
  measurementUnit?: string;
  developmentTypes?: JvDevelopmentType[];
  preferredSharingRatio?: string;
  proposalDetails?: string;
  minimumTitleRequirements?: JvTitleRequirement[] | string[];
  willingToConsiderPendingTitle?: boolean;
  additionalRequirements?: string;
}

/** Buy / rent / off-plan `propertyDetails` extras for off-plan. */
export interface PropertyDetailsPayload {
  propertyType?: string;
  buildingType?: string;
  minBedrooms?: string;
  minBathrooms?: number;
  leaseTerm?: string;
  propertyCondition?: string;
  purpose?: string;
  landSize?: string;
  minLandSize?: string;
  maxLandSize?: string;
  measurementUnit?: string;
  documentTypes?: string[];
  landConditions?: string[];
  expectedCompletionDate?: string;
  developmentStage?: string;
  paymentPlan?: string;
}

export interface JointVentureContactPayload {
  companyName: string;
  contactPerson: string;
  email: string;
  phoneNumber: string;
  cacRegistrationNumber?: string;
}

export interface BuyerContactPayload {
  fullName: string;
  email: string;
  phoneNumber: string;
}

export type PreferencePayload = Record<string, unknown>;

export const PREFERENCE_TYPE_LABELS: Record<PreferenceType, string> = {
  buy: "Buy",
  rent: "Rent",
  "joint-venture": "Joint Venture",
  shortlet: "Shortlet",
  "off-plan": "Off-Plan",
};

export function preferenceModeForType(type: PreferenceType): PreferenceMode {
  switch (type) {
    case "buy":
    case "off-plan":
      return "buy";
    case "rent":
      return "tenant";
    case "joint-venture":
      return "developer";
    case "shortlet":
      return "shortlet";
  }
}
