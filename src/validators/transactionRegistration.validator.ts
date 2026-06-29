import Joi from "joi";
import type { TransactionRegistrationType } from "../models/transactionRegistration";

const transactionTypes: TransactionRegistrationType[] = [
  "rental_agreement",
  "outright_sale",
  "off_plan_purchase",
  "joint_venture",
];

const buyerSchema = Joi.object({
  email: Joi.string().email().trim().required(),
  fullName: Joi.string().trim().min(2).max(200).required(),
  phoneNumber: Joi.string().trim().required(),
});

const propertyIdentificationBuilding = Joi.object({
  type: Joi.string().valid("building").required(),
  exactAddress: Joi.string().trim().min(1).required(),
  lpin: Joi.string().trim().allow("", null).optional(),
  titleReference: Joi.string().trim().allow("", null).optional(),
  ownerVerification: Joi.string().trim().allow("", null).optional(),
  gpsCoordinates: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
  }).optional(),
}).required();

const propertyIdentificationLand = Joi.object({
  type: Joi.string().valid("land").required(),
  exactAddress: Joi.string().trim().allow("", null).optional(),
  gpsCoordinates: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
  }).required(),
  surveyPlanDetails: Joi.string().trim().allow("", null).optional(),
  ownerConfirmation: Joi.string().trim().allow("", null).optional(),
}).required();

export const buyerIntentSchema = Joi.object({
  inspectionId: Joi.string().required(),
  email: Joi.string().email().trim().required(),
  wishToProceed: Joi.boolean().valid(true).required(),
});

export const registerTransactionSchema = Joi.object({
  transactionType: Joi.string()
    .valid(...transactionTypes)
    .required(),
  propertyId: Joi.string().trim().allow("", null).optional(),
  agentId: Joi.string().trim().allow("", null).optional(),
  offPlatformPartyType: Joi.string().valid("agent", "property_owner").optional(),
  practitioner: Joi.object({
    fullName: Joi.string().trim().min(2).max(200).required(),
    email: Joi.string().email().trim().required(),
    phoneNumber: Joi.string().trim().min(7).required(),
    companyName: Joi.string().trim().allow("", null).optional(),
    licenceNumber: Joi.string().trim().allow("", null).optional(),
    isOnPlatform: Joi.boolean().optional(),
  }).optional(),
  inspectionId: Joi.string().allow("", null).optional(),
  buyer: buyerSchema.required(),
  transactionValue: Joi.number().min(0).required(),
  propertyIdentification: Joi.alternatives()
    .try(propertyIdentificationBuilding, propertyIdentificationLand)
    .required(),
});

const practitionerFrontendSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(200).required(),
  email: Joi.string().email().trim().required(),
  phoneNumber: Joi.string().trim().min(7).required(),
  companyName: Joi.string().trim().allow("", null).optional(),
  licenceNumber: Joi.string().trim().allow("", null).optional(),
  isOnPlatform: Joi.boolean().optional(),
});

/** Frontend slugs for transaction type */
export const REGISTER_TYPE_SLUGS = [
  "rental",
  "outright-purchase",
  "contract-of-sale",
  "off-plan",
  "joint-venture",
] as const;

/** Frontend property identification (flat lat/lng, titleNumber, ownerName, etc.) */
const propertyIdentificationFrontend = Joi.object({
  type: Joi.string()
    .valid("land", "residential", "commercial")
    .required(),
  exactAddress: Joi.string().trim().allow("", null).optional(),
  titleNumber: Joi.string().trim().allow("", null).optional(),
  ownerName: Joi.string().trim().allow("", null).optional(),
  lat: Joi.number().min(-90).max(90).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
  surveyPlanRef: Joi.string().trim().allow("", null).optional(),
  ownerConfirmation: Joi.any().optional(),
}).required();

/** Register payload as sent by the public frontend (slugs, flat propertyIdentification) */
export const registerTransactionFrontendSchema = Joi.object({
  transactionType: Joi.string()
    .valid(...REGISTER_TYPE_SLUGS)
    .required(),
  propertyId: Joi.string().trim().allow("", null).optional(),
  agentId: Joi.string().trim().allow("", null).optional(),
  offPlatformPartyType: Joi.string().valid("agent", "property_owner").optional(),
  practitioner: practitionerFrontendSchema.optional(),
  inspectionId: Joi.string().allow("", null).optional(),
  buyer: buyerSchema.required(),
  transactionValue: Joi.number().min(0).required(),
  propertyIdentification: propertyIdentificationFrontend,
  paymentReceiptFileName: Joi.string().trim().min(1).optional(),
  paymentReceiptBase64: Joi.string().trim().min(1).optional(),
  paymentReceiptUrl: Joi.string().uri().trim().optional(),
  buyerIdFileName: Joi.string().trim().min(1).optional(),
  buyerIdBase64: Joi.string().trim().min(1).optional(),
  buyerIdUrl: Joi.string().uri().trim().optional(),
  deedsOfAssignmentFileName: Joi.string().trim().min(1).optional(),
  deedsOfAssignmentBase64: Joi.string().trim().min(1).optional(),
  deedsOfAssignmentUrl: Joi.string().uri().trim().optional(),
  conveyanceFileName: Joi.string().trim().min(1).optional(),
  conveyanceBase64: Joi.string().trim().min(1).optional(),
  conveyanceUrl: Joi.string().uri().trim().optional(),
})
  .or("paymentReceiptBase64", "paymentReceiptUrl")
  .or("buyerIdBase64", "buyerIdUrl")
  .custom((value, helpers) => {
    const propertyId =
      value.propertyId != null && String(value.propertyId).trim().length > 0
        ? String(value.propertyId).trim()
        : "";
    const pr = value.practitioner;
    const practitionerOnPlatform = pr?.isOnPlatform === true;
    const hasPractitioner =
      pr &&
      String(pr.fullName || "").trim() &&
      String(pr.email || "").trim() &&
      String(pr.phoneNumber || "").trim();
    const partyType = value.offPlatformPartyType;
    if (!propertyId && practitionerOnPlatform) {
      return helpers.error("any.custom", {
        message:
          "For properties not listed on KHABITEQ, uncheck practitioner on KHABITEQ and provide the agent or property owner you transacted with.",
      });
    }
    if (!propertyId && !hasPractitioner) {
      return helpers.error("any.custom", {
        message:
          "For properties not listed on KHABITEQ, contact details for the agent or property owner are required.",
      });
    }
    if (hasPractitioner && !practitionerOnPlatform) {
      if (!partyType) {
        return helpers.error("any.custom", {
          message: "Select whether you transacted with a property owner or an agent.",
        });
      }
    }
    return value;
  })
  .messages({
    "object.missing": "Payment receipt and buyer ID document are required.",
    "any.custom": "{{#message}}",
  });

export const publicSearchSchema = Joi.object({
  address: Joi.string().trim().min(1).optional(),
  propertyId: Joi.string().trim().min(1).optional(),
  lat: Joi.number().min(-90).max(90).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
});

/** Query params for GET /transaction-registration/check */
export const checkPropertyQuerySchema = Joi.object({
  propertyId: Joi.string().trim().optional(),
  address: Joi.string().trim().optional(),
  lat: Joi.number().min(-90).max(90).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
}).custom((value, helpers) => {
  const hasPropertyId = value.propertyId && String(value.propertyId).trim().length > 0;
  const hasAddress = value.address && String(value.address).trim().length > 0;
  const hasGps = value.lat != null && value.lng != null;
  if (!hasPropertyId && !hasAddress && !hasGps) {
    return helpers.error("any.custom", {
      message: "Provide propertyId, address, or both lat and lng.",
    });
  }
  return value;
});

/** Query params for GET /transaction-registration/egis-validate */
export const egisValidateQuerySchema = Joi.object({
  propertyId: Joi.string().trim().allow("", null).optional(),
  address: Joi.string().trim().allow("", null).optional(),
  lat: Joi.number().min(-90).max(90).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
});
