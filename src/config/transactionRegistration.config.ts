import type { TransactionRegistrationType } from "../models/transactionRegistration";

export interface ValueBand {
  minValueNaira: number;
  maxValueNaira: number;
  processingFeeNaira: number;
  label: string;
}

export interface TransactionTypeConfig {
  type: TransactionRegistrationType;
  label: string;
  description: string;
  eligibilityCriteria: string[];
  regulatoryRequirements: string[];
  valueBands: ValueBand[];
  /** Transactions at or above this value (in Naira) require mandatory registration. */
  mandatoryRegistrationThresholdNaira: number;
}

export const TRANSACTION_TYPE_CONFIGS: TransactionTypeConfig[] = [
  {
    type: "rental_agreement",
    label: "Rental Agreements",
    description: "Registration of residential or commercial rental/lease agreements.",
    eligibilityCriteria: [
      "Valid lease/rental agreement between landlord and tenant",
      "Property must be within KHABITEQ jurisdiction",
      "Minimum lease term as per state guidelines",
    ],
    regulatoryRequirements: [
      "Tenancy agreement in writing",
      "Commission compliance as per KHABITEQ guidelines",
      "Landlord and tenant identification verification",
    ],
    mandatoryRegistrationThresholdNaira: 1_000_000,
    valueBands: [
      { minValueNaira: 0, maxValueNaira: 1_000_000, processingFeeNaira: 5_000, label: "Up to ₦1M" },
      { minValueNaira: 1_000_001, maxValueNaira: 5_000_000, processingFeeNaira: 10_000, label: "₦1M – ₦5M" },
      { minValueNaira: 5_000_001, maxValueNaira: 20_000_000, processingFeeNaira: 25_000, label: "₦5M – ₦20M" },
      { minValueNaira: 20_000_001, maxValueNaira: Number.MAX_SAFE_INTEGER, processingFeeNaira: 50_000, label: "Above ₦20M" },
    ],
  },
  {
    type: "outright_sale",
    label: "Outright Property Sales",
    description: "Registration of completed or in-progress outright property sales.",
    eligibilityCriteria: [
      "Sale agreement between buyer and seller",
      "Property must be within KHABITEQ jurisdiction",
      "Clear title or documented ownership",
    ],
    regulatoryRequirements: [
      "Duly executed sale agreement",
      "Commission compliance",
      "Title verification and ownership confirmation",
    ],
    mandatoryRegistrationThresholdNaira: 5_000_000,
    valueBands: [
      { minValueNaira: 0, maxValueNaira: 5_000_000, processingFeeNaira: 15_000, label: "Up to ₦5M" },
      { minValueNaira: 5_000_001, maxValueNaira: 20_000_000, processingFeeNaira: 35_000, label: "₦5M – ₦20M" },
      { minValueNaira: 20_000_001, maxValueNaira: 100_000_000, processingFeeNaira: 75_000, label: "₦20M – ₦100M" },
      { minValueNaira: 100_000_001, maxValueNaira: Number.MAX_SAFE_INTEGER, processingFeeNaira: 150_000, label: "Above ₦100M" },
    ],
  },
  {
    type: "off_plan_purchase",
    label: "Off-Plan Purchases",
    description: "Registration of off-plan or development purchase agreements.",
    eligibilityCriteria: [
      "Valid off-plan purchase agreement with developer",
      "Development within KHABITEQ jurisdiction",
      "Developer registration where applicable",
    ],
    regulatoryRequirements: [
      "Off-plan agreement and payment schedule",
      "Commission and disclosure compliance",
      "Developer and project verification",
    ],
    mandatoryRegistrationThresholdNaira: 3_000_000,
    valueBands: [
      { minValueNaira: 0, maxValueNaira: 5_000_000, processingFeeNaira: 20_000, label: "Up to ₦5M" },
      { minValueNaira: 5_000_001, maxValueNaira: 25_000_000, processingFeeNaira: 45_000, label: "₦5M – ₦25M" },
      { minValueNaira: 25_000_001, maxValueNaira: 100_000_000, processingFeeNaira: 90_000, label: "₦25M – ₦100M" },
      { minValueNaira: 100_000_001, maxValueNaira: Number.MAX_SAFE_INTEGER, processingFeeNaira: 180_000, label: "Above ₦100M" },
    ],
  },
  {
    type: "joint_venture",
    label: "Joint Venture Arrangements",
    description: "Registration of property-related joint venture or partnership arrangements.",
    eligibilityCriteria: [
      "Written JV agreement between parties",
      "Property or project within KHABITEQ jurisdiction",
      "Clear roles and contribution terms",
    ],
    regulatoryRequirements: [
      "JV agreement and ownership structure",
      "Commission and disclosure compliance",
      "Party identification and contribution verification",
    ],
    mandatoryRegistrationThresholdNaira: 5_000_000,
    valueBands: [
      { minValueNaira: 0, maxValueNaira: 10_000_000, processingFeeNaira: 30_000, label: "Up to ₦10M" },
      { minValueNaira: 10_000_001, maxValueNaira: 50_000_000, processingFeeNaira: 60_000, label: "₦10M – ₦50M" },
      { minValueNaira: 50_000_001, maxValueNaira: Number.MAX_SAFE_INTEGER, processingFeeNaira: 120_000, label: "Above ₦50M" },
    ],
  },
];

export function getConfigForType(type: TransactionRegistrationType): TransactionTypeConfig | undefined {
  return TRANSACTION_TYPE_CONFIGS.find((c) => c.type === type);
}

export function getProcessingFeeNaira(_type: TransactionRegistrationType, transactionValueNaira: number): number {
  if (transactionValueNaira < TRANSACTION_REGISTRATION_FEE_BANDS[0].minValueNaira) return 0;
  const band = TRANSACTION_REGISTRATION_FEE_BANDS.find(
    (b) => transactionValueNaira >= b.minValueNaira && transactionValueNaira <= b.maxValueNaira
  );
  return band ? band.processingFeeNaira : TRANSACTION_REGISTRATION_FEE_BANDS[1].processingFeeNaira;
}

/**
 * Transaction registration processing fee by property/transaction value (LASRERA).
 * 5M – 50M Naira → ₦100,000; above 50M → ₦150,000.
 */
export const TRANSACTION_REGISTRATION_FEE_BANDS: ValueBand[] = [
  { minValueNaira: 5_000_000, maxValueNaira: 50_000_000, processingFeeNaira: 100_000, label: "₦5M – ₦50M" },
  { minValueNaira: 50_000_001, maxValueNaira: Number.MAX_SAFE_INTEGER, processingFeeNaira: 150_000, label: "Above ₦50M" },
];

export function isMandatoryRegistration(type: TransactionRegistrationType, transactionValueNaira: number): boolean {
  const config = getConfigForType(type);
  if (!config) return false;
  return transactionValueNaira >= config.mandatoryRegistrationThresholdNaira;
}

// --- Safe Transaction Guidelines (content for the module) ---

export interface SafeTransactionGuidelines {
  title: string;
  introduction: string;
  sections: {
    heading: string;
    content: string[];
  }[];
}

export const SAFE_TRANSACTION_GUIDELINES: SafeTransactionGuidelines = {
  title: "Safe Transaction Guidelines",
  introduction:
    "As the buyer or tenant, review these requirements before you register your transaction with KHABITEQ. Registration is your responsibility — your agent may help with due diligence, but you submit the registration yourself.",
  sections: [
    {
      heading: "Required Documentation Checklist",
      content: [
        "Your valid ID (e.g. NIN, international passport, or driver's licence).",
        "A receipt or proof of payment for the transaction value you paid to the seller or landlord.",
      ],
    },
  
    {
      heading: "Ownership Verification Standards",
      content: [
        "Ask the seller or landlord for proof they own the property or have authority to sell or let.",
        "For completed property, request a Certificate of Occupancy or registered title and check the name matches.",
        "For off-plan purchases, confirm the developer's title and project approvals before you commit.",
      ],
    },
    {
      heading: "Title Verification Recommendations",
      content: [
        "Use Check property status on this page, or search the land registry, before you commit.",
        "Confirm there are no active registrations, encumbrances, liens, or disputes on the property.",
        "Verify the person you are dealing with is the registered owner or has written authority to act for them.",
      ],
    },
    {
      heading: "Dispute Resolution Procedures",
      content: [
        "If a dispute arises after you register, you may seek help through KHABITEQ support channels for mediation.",
        "Your registered transaction can be referred to KHABITEQ for dispute resolution support.",
        "Legal action remains available if mediation does not resolve the matter.",
      ],
    },
    {
      heading: "Mandatory Data Disclosure Requirements",
      content: [
        "You must provide the property address and/or GPS coordinates as required for the property type.",
        "You must declare the transaction type, value, and your contact details for the registry.",
        "You must upload a proof of payment for the transaction value you paid to the seller or landlord.",
        "You must upload your valid ID.",
        "By submitting registration, you confirm the information you provide is true and complete.",
      ],
    },
  ],
};
