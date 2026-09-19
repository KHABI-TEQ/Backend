export type ProfessionalCategory = "lawyer" | "surveyor" | "valuer";
export type ServicePhase = 1 | 2;
export type CatalogFulfillment =
  | "document-verification"
  | "survey-request"
  | "catalog-request";

export type CatalogRequiredField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "file" | "select";
  required: boolean;
  options?: string[];
  help?: string;
};

export type ProfessionalServiceDefinition = {
  slug: string;
  name: string;
  category: ProfessionalCategory;
  phase: ServicePhase;
  comingSoon: boolean;
  customerPrice: number;
  platformFeePercent: number;
  deliveryTime: string;
  description: string;
  scope: string[];
  outOfScope: string[];
  requiredFields: CatalogRequiredField[];
  deliverable: string;
  disclaimer: string;
  fulfillment: CatalogFulfillment;
};

const COMMISSION_SPLIT_NOTE =
  "The displayed fee is what you pay. Khabiteq retains a disclosed platform fee; the balance is paid to the assigned professional.";

export const PROFESSIONAL_SERVICE_CATALOG: ProfessionalServiceDefinition[] = [
  {
    slug: "property-document-review",
    name: "Property Document Review",
    category: "lawyer",
    phase: 1,
    comingSoon: false,
    customerPrice: 50000,
    platformFeePercent: 10,
    deliveryTime: "2–4 working days after payment",
    description:
      "A qualified property lawyer reviews the documents you upload and issues a written review of observations, gaps, and issues that need further investigation.",
    scope: [
      "Review of uploaded property documents",
      "Written findings and observations",
      "Identification of missing information",
      "Guidance on issues that require further investigation",
    ],
    outOfScope: [
      "Does not confirm that the property has a valid title",
      "Does not replace a full title search or government registry investigation",
      "Does not constitute legal representation in a transaction unless separately agreed",
    ],
    requiredFields: [
      {
        key: "documentType",
        label: "Document type",
        type: "select",
        required: true,
        options: [
          "certificate-of-occupancy",
          "deed-of-assignment",
          "deed-of-partition",
          "governors-consent",
          "deed-of-lease",
          "deed-of-conveyance-or-sale",
          "land-certificate",
          "other",
        ],
      },
      {
        key: "documentUrl",
        label: "Property document",
        type: "file",
        required: true,
        help: "Upload a clear PDF or image of the document.",
      },
      {
        key: "propertyAddress",
        label: "Property location",
        type: "text",
        required: true,
      },
      {
        key: "notes",
        label: "What should the lawyer focus on?",
        type: "textarea",
        required: false,
      },
    ],
    deliverable: "Written legal review and findings",
    disclaimer:
      "Document review does not automatically confirm that a property has valid title. The lawyer’s scope is limited to the documents and information you provide.",
    fulfillment: "document-verification",
  },
  {
    slug: "survey-plan-review",
    name: "Survey Plan Review",
    category: "surveyor",
    phase: 1,
    comingSoon: false,
    customerPrice: 40000,
    platformFeePercent: 10,
    deliveryTime: "2–5 working days after payment",
    description:
      "A licensed surveyor reviews your survey plan and property information and issues technical observations and agreed findings.",
    scope: [
      "Review of the uploaded survey plan",
      "Technical observations on the plan as presented",
      "Notes on inconsistencies or missing survey information",
    ],
    outOfScope: [
      "Does not include a physical boundary survey unless separately requested",
      "Does not replace beacon identification on site",
    ],
    requiredFields: [
      {
        key: "surveyPlanUrl",
        label: "Survey plan",
        type: "file",
        required: true,
      },
      {
        key: "propertyAddress",
        label: "Property location",
        type: "text",
        required: true,
      },
      {
        key: "notes",
        label: "Additional information",
        type: "textarea",
        required: false,
      },
    ],
    deliverable: "Technical observations and agreed findings",
    disclaimer:
      "A survey plan review is a desktop assessment of the documents provided. It is not a site survey or beacon identification.",
    fulfillment: "survey-request",
  },
  {
    slug: "property-legal-consultation",
    name: "Property Legal Consultation",
    category: "lawyer",
    phase: 1,
    comingSoon: false,
    customerPrice: 35000,
    platformFeePercent: 10,
    deliveryTime: "1–3 working days after payment",
    description:
      "A scheduled written or remote consultation with a property lawyer on purchase, land acquisition, or ownership documentation.",
    scope: [
      "Consultation on the issue you describe",
      "Practical next-step guidance",
      "Written summary of advice given",
    ],
    outOfScope: [
      "Does not include court representation",
      "Does not include a full document verification unless that service is purchased separately",
    ],
    requiredFields: [
      {
        key: "consultationTopic",
        label: "What do you need advice on?",
        type: "textarea",
        required: true,
      },
      {
        key: "propertyAddress",
        label: "Property location (if applicable)",
        type: "text",
        required: false,
      },
      {
        key: "documentUrl",
        label: "Supporting document (optional)",
        type: "file",
        required: false,
      },
    ],
    deliverable: "Written consultation summary and recommended next steps",
    disclaimer:
      "Consultation advice is based on the information you provide and is not a title guarantee.",
    fulfillment: "catalog-request",
  },
  {
    slug: "property-valuation-consultation",
    name: "Property Valuation Consultation",
    category: "valuer",
    phase: 1,
    comingSoon: false,
    customerPrice: 40000,
    platformFeePercent: 10,
    deliveryTime: "2–4 working days after payment",
    description:
      "A property valuer reviews the location, type, size, purpose, and available documents, then advises on valuation approach and expected range.",
    scope: [
      "Desktop review of the information you provide",
      "Guidance on valuation purpose and approach",
      "Indicative commentary — not a full inspection valuation",
    ],
    outOfScope: [
      "Does not include a site inspection or formal valuation certificate unless a Phase 2 inspection service is booked",
    ],
    requiredFields: [
      {
        key: "propertyAddress",
        label: "Property location",
        type: "text",
        required: true,
      },
      {
        key: "propertyType",
        label: "Property type",
        type: "text",
        required: true,
        help: "e.g. 3-bedroom terrace, land, commercial shop",
      },
      {
        key: "propertySize",
        label: "Size (if known)",
        type: "text",
        required: false,
      },
      {
        key: "valuationPurpose",
        label: "Purpose of valuation",
        type: "select",
        required: true,
        options: ["purchase", "sale", "rental", "investment", "other"],
      },
      {
        key: "documentUrl",
        label: "Available documents (optional)",
        type: "file",
        required: false,
      },
    ],
    deliverable: "Written valuation consultation and recommended next steps",
    disclaimer:
      "A consultation is not a formal valuation report. Formal inspection valuations are a separate Phase 2 service.",
    fulfillment: "catalog-request",
  },
  {
    slug: "preliminary-property-information-assessment",
    name: "Preliminary Property Information Assessment",
    category: "lawyer",
    phase: 1,
    comingSoon: false,
    customerPrice: 25000,
    platformFeePercent: 10,
    deliveryTime: "1–3 working days after payment",
    description:
      "An initial assessment of the property information and documents you have, highlighting obvious gaps before you commit to a fuller review or search.",
    scope: [
      "Review of the information pack you upload",
      "Checklist of missing items",
      "Recommendation of the next paid service if needed",
    ],
    outOfScope: [
      "Does not confirm title",
      "Does not include registry searches or site inspection",
    ],
    requiredFields: [
      {
        key: "propertyAddress",
        label: "Property location",
        type: "text",
        required: true,
      },
      {
        key: "notes",
        label: "What information do you already have?",
        type: "textarea",
        required: true,
      },
      {
        key: "documentUrl",
        label: "Any available document",
        type: "file",
        required: false,
      },
    ],
    deliverable: "Preliminary assessment note and recommended next service",
    disclaimer:
      "This is an initial information check, not a title verification or legal opinion on ownership.",
    fulfillment: "catalog-request",
  },
  {
    slug: "property-valuation-inspection",
    name: "Property Valuation Inspection",
    category: "valuer",
    phase: 2,
    comingSoon: true,
    customerPrice: 0,
    platformFeePercent: 10,
    deliveryTime: "Quoted after briefing",
    description: "On-site inspection and formal valuation report.",
    scope: ["Physical inspection", "Formal valuation report"],
    outOfScope: [],
    requiredFields: [],
    deliverable: "Valuation report",
    disclaimer: "Physical services will open after Phase 1 digital services.",
    fulfillment: "catalog-request",
  },
  {
    slug: "land-survey",
    name: "Land Survey",
    category: "surveyor",
    phase: 2,
    comingSoon: true,
    customerPrice: 0,
    platformFeePercent: 10,
    deliveryTime: "Quoted after briefing",
    description: "Physical land survey and related site work.",
    scope: ["Site measurement", "Survey plan preparation"],
    outOfScope: [],
    requiredFields: [],
    deliverable: "Survey output as agreed",
    disclaimer: "Physical services will open after Phase 1 digital services.",
    fulfillment: "catalog-request",
  },
  {
    slug: "boundary-survey",
    name: "Boundary Survey",
    category: "surveyor",
    phase: 2,
    comingSoon: true,
    customerPrice: 0,
    platformFeePercent: 10,
    deliveryTime: "Quoted after briefing",
    description: "On-site boundary and beacon identification.",
    scope: ["Beacon identification", "Boundary confirmation"],
    outOfScope: [],
    requiredFields: [],
    deliverable: "Site inspection / boundary report",
    disclaimer: "Physical services will open after Phase 1 digital services.",
    fulfillment: "catalog-request",
  },
];

export const CATALOG_AUTO_MATCH_NOTE =
  "We will notify all approved professionals in this category who are set up to take this work. The first to accept will handle your request. You pay after they accept.";

export const CATALOG_PAYMENT_NOTE = COMMISSION_SPLIT_NOTE;

export function getCatalogService(slug: string): ProfessionalServiceDefinition | undefined {
  return PROFESSIONAL_SERVICE_CATALOG.find((s) => s.slug === slug);
}

export function listActiveCatalogServices(): ProfessionalServiceDefinition[] {
  return PROFESSIONAL_SERVICE_CATALOG.filter((s) => !s.comingSoon);
}

export function publicCatalogCard(service: ProfessionalServiceDefinition) {
  const platformFee = Math.round((service.customerPrice * service.platformFeePercent) / 100);
  return {
    ...service,
    platformFee,
    professionalFee: Math.max(0, service.customerPrice - platformFee),
    currency: "NGN",
  };
}
