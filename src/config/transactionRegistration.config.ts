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
      "Property must be within LASRERA jurisdiction",
      "Minimum lease term as per state guidelines",
    ],
    regulatoryRequirements: [
      "Tenancy agreement in writing",
      "Commission compliance as per LASRERA guidelines",
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
      "Property must be within LASRERA jurisdiction",
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
      "Development within LASRERA jurisdiction",
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
      "Property or project within LASRERA jurisdiction",
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

export function getProcessingFeeNaira(type: TransactionRegistrationType, transactionValueNaira: number): number {
  const config = getConfigForType(type);
  if (!config) return 0;
  const band = config.valueBands.find(
    (b) => transactionValueNaira >= b.minValueNaira && transactionValueNaira <= b.maxValueNaira
  );
  return band ? band.processingFeeNaira : 0;
}

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
    "Before registering your transaction with LASRERA, please review the following requirements. This ensures regulatory awareness and strengthens consumer protection.",
  sections: [
    {
      heading: "Required Documentation Checklist",
      content: [
        "Valid identity document (e.g. NIN, international passport, driver's licence).",
        "Proof of address where applicable.",
        "Duly executed agreement (lease, sale, off-plan or JV as applicable).",
        "Evidence of ownership or authority to deal (for sellers/landlords).",
        "Payment receipts or proof of transaction value where required.",
      ],
    },
    {
      heading: "Commission Compliance Rules",
      content: [
        "Commission rates and who bears them must be clearly stated in the agreement.",
        "LASRERA guidelines on agency commission must be adhered to.",
        "All commission-related payments must be documented.",
      ],
    },
    {
      heading: "Ownership Verification Standards",
      content: [
        "Seller/landlord must provide evidence of title or right to deal.",
        "Where applicable, Certificate of Occupancy or registered title should be verified.",
        "For off-plan, developer's title and project approvals should be confirmed.",
      ],
    },
    {
      heading: "Title Verification Recommendations",
      content: [
        "Conduct a search at the relevant land registry.",
        "Confirm there are no encumbrances, liens or disputes on the property.",
        "Verify that the person dealing is the registered owner or has authority.",
      ],
    },
    {
      heading: "Dispute Resolution Procedures",
      content: [
        "Parties are encouraged to resolve disputes through LASRERA mediation channels.",
        "Registered transactions may be referred to LASRERA for dispute resolution.",
        "Legal recourse remains available where mediation does not resolve the matter.",
      ],
    },
    {
      heading: "Mandatory Data Disclosure Requirements",
      content: [
        "Property address and/or GPS coordinates as required for the transaction type.",
        "Transaction type, value and parties' contact details for registry purposes.",
        "Declaration that the information provided is true and complete.",
      ],
    },
  ],
};
