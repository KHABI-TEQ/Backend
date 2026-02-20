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
  propertyId: Joi.string().required(),
  inspectionId: Joi.string().allow("", null).optional(),
  buyer: buyerSchema.required(),
  transactionValue: Joi.number().min(0).required(),
  propertyIdentification: Joi.alternatives()
    .try(propertyIdentificationBuilding, propertyIdentificationLand)
    .required(),
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
    .valid("land", "residential", "commercial", "duplex")
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
  propertyId: Joi.string().required(),
  inspectionId: Joi.string().allow("", null).optional(),
  buyer: buyerSchema.required(),
  transactionValue: Joi.number().min(0).required(),
  propertyIdentification: propertyIdentificationFrontend,
  paymentReceiptFileName: Joi.string().allow("", null).optional(),
  paymentReceiptBase64: Joi.string().allow("", null).optional(),
});

export const publicSearchSchema = Joi.object({
  address: Joi.string().trim().min(1).optional(),
  lpin: Joi.string().trim().min(1).optional(),
  lat: Joi.number().min(-90).max(90).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
});

/** Query params for GET /transaction-registration/check */
export const checkPropertyQuerySchema = Joi.object({
  propertyId: Joi.string().trim().required(),
});

/** Query params for GET /transaction-registration/egis-validate */
export const egisValidateQuerySchema = Joi.object({
  propertyId: Joi.string().trim().allow("", null).optional(),
  address: Joi.string().trim().allow("", null).optional(),
  lat: Joi.number().min(-90).max(90).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
});
