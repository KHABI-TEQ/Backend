import Joi from "joi";
import { joiPilotState } from "../common/constants/pilotLocation";
import {
  normalizePreferenceBuildingType,
  normalizePreferenceCondition,
} from "../common/constants/preferenceConditionBuilding";
import {
  JV_DEVELOPMENT_TYPE_VALUES,
  PREFERENCE_DOCUMENT_TYPE_VALUES,
  normalizeJvDevelopmentType,
  normalizeOffPlanDevelopmentStage,
  normalizeOffPlanPaymentPlan,
  normalizePreferenceDocumentType,
  normalizeShortletPropertyType,
  normalizeTravelType,
} from "../common/constants/preferenceSelectableOptions";

/** Allowed land measurement units for preferences (lowercased on validate). Legacy hectare values kept for stored data; emails map them to "acres". */
export const PREFERENCE_MEASUREMENT_UNIT_VALUES = [
  "plot",
  "sqm",
  "acres",
  "hectares",
  "hectare",
  "ha",
] as const;

const preferenceCondition = Joi.string()
  .trim()
  .allow("")
  .custom((value) => normalizePreferenceCondition(value) || value);

const preferenceBuildingType = Joi.string()
  .trim()
  .allow("")
  .custom((value) => normalizePreferenceBuildingType(value) || value);

const preferenceMeasurementUnit = Joi.string()
  .trim()
  .allow("")
  .optional()
  .custom((value, helpers) => {
    const t = String(value || "").trim().toLowerCase();
    if (!t) return "";
    const mapped =
      t === "plots" || t === "plot"
        ? "plot"
        : t === "sqm" || t === "sq.m" || t === "square meter" || t === "square metres" || t === "square meters"
          ? "sqm"
          : t === "acre"
            ? "acres"
            : t === "hectare" || t === "ha"
              ? "hectares"
              : t;
    if (!(PREFERENCE_MEASUREMENT_UNIT_VALUES as readonly string[]).includes(mapped)) {
      return helpers.error("any.only");
    }
    return mapped;
  })
  .messages({
    "any.only":
      "measurementUnit must be one of: plot, sqm, acres (or legacy hectares / hectare / ha)",
  });

const preferenceDocumentType = Joi.string()
  .trim()
  .custom((value) => normalizePreferenceDocumentType(value) || String(value || "").trim());

const jvDevelopmentType = Joi.string()
  .trim()
  .custom((value, helpers) => {
    const next = normalizeJvDevelopmentType(value);
    if (next && (JV_DEVELOPMENT_TYPE_VALUES as readonly string[]).includes(next)) {
      return next;
    }
    return helpers.error("any.only");
  })
  .messages({
    "any.only":
      "developmentTypes must be one of: residential, commercial, mixed-use, industrial",
  });

const jvTitleRequirement = Joi.string()
  .trim()
  .custom((value, helpers) => {
    const next = normalizePreferenceDocumentType(value);
    if (next && (PREFERENCE_DOCUMENT_TYPE_VALUES as readonly string[]).includes(next)) {
      return next;
    }
    return helpers.error("any.only");
  })
  .messages({
    "any.only": `minimumTitleRequirements must be one of: ${PREFERENCE_DOCUMENT_TYPE_VALUES.join(", ")}`,
  });

export const preferenceValidationSchema = Joi.object({
  preferenceType: Joi.string()
    .valid("buy", "rent", "joint-venture", "shortlet", "off-plan")
    .required(),

  preferenceMode: Joi.string()
    .valid("buy", "tenant", "developer", "shortlet")
    .required(),

  location: Joi.object({
    state: joiPilotState(),
    localGovernmentAreas: Joi.array().items(Joi.string()).default([]),
    lgasWithAreas: Joi.array()
      .items(
        Joi.object({
          lgaName: Joi.string().required(),
          areas: Joi.array().items(Joi.string()).default([]),
          areasWithEstates: Joi.array()
            .items(
              Joi.object({
                areaName: Joi.string().required(),
                estates: Joi.array().items(Joi.string()).default([]),
              }),
            )
            .default([]),
        }),
      )
      .default([]),
    customLocation: Joi.string().allow("").default(""),
  }).required(),

  budget: Joi.object({
    minPrice: Joi.number().required(),
    maxPrice: Joi.number().required(),
    currency: Joi.string().required(),
  }).required(),

  // For Buy, Rent & Off-plan
  propertyDetails: Joi.object({
    propertyType: Joi.string(),
    buildingType: preferenceBuildingType,
    minBedrooms: Joi.string(),
    minBathrooms: Joi.number(),
    toilets: Joi.alternatives()
      .try(Joi.number().min(0), Joi.string().trim().allow(""))
      .optional(),
    leaseTerm: Joi.string().allow(""),
    propertyCondition: preferenceCondition,
    purpose: Joi.string().allow(""),
    landSize: Joi.string().allow(""),
    minLandSize: Joi.string().allow(""), // For SQM range
    maxLandSize: Joi.string().allow(""), // For SQM range
    measurementUnit: preferenceMeasurementUnit,
    documentTypes: Joi.array().items(preferenceDocumentType).default([]),
    landConditions: Joi.array().items(Joi.string()).default([]),
    expectedCompletionDate: Joi.string().trim().allow("").optional(),
    developmentStage: Joi.string()
      .trim()
      .allow("")
      .custom((value) => normalizeOffPlanDevelopmentStage(value) || value)
      .optional(),
    paymentPlan: Joi.string()
      .trim()
      .allow("")
      .custom((value) => normalizeOffPlanPaymentPlan(value) || value)
      .optional(),
  }).optional(),

  // For Joint Venture
  // developmentDetails: Joi.object({
  //   minLandSize: Joi.string(),
  //   measurementUnit: Joi.string(),
  //   jvType: Joi.string(),
  //   propertyType: Joi.string(),
  //   expectedStructureType: Joi.string(),
  //   timeline: Joi.string(),
  //   budgetRange: Joi.string(),
  //   documentTypes: Joi.array().items(Joi.string()).default([]),
  //   landConditions: Joi.array().items(Joi.string()).default([]),
  //   buildingType: Joi.string(),
  //   propertyCondition: Joi.string(),
  //   minBedrooms: Joi.string(),
  //   minBathrooms: Joi.number(),
  //   purpose: Joi.string(),
  // }).optional(),


  developmentDetails: Joi.object({
    minLandSize: Joi.string().trim(),
    maxLandSize: Joi.string().trim(),
    measurementUnit: preferenceMeasurementUnit,
    developmentTypes: Joi.array().items(jvDevelopmentType).default([]),
    preferredSharingRatio: Joi.string().trim(),
    proposalDetails: Joi.string().trim(),
    minimumTitleRequirements: Joi.array().items(jvTitleRequirement).default([]),
    willingToConsiderPendingTitle: Joi.boolean(),
    additionalRequirements: Joi.string().trim(),
  }).optional(),

  // For Shortlet
  bookingDetails: Joi.object({
    propertyType: Joi.string().custom((value) => normalizeShortletPropertyType(value) || value),
    buildingType: preferenceBuildingType,
    minBedrooms: Joi.string(),
    minBathrooms: Joi.number(),
    numberOfGuests: Joi.number(),
    checkInDate: Joi.date(),
    checkOutDate: Joi.date(),
    travelType: Joi.string().custom((value) => normalizeTravelType(value) || value),
    preferredCheckInTime: Joi.string(),
    preferredCheckOutTime: Joi.string(),
    propertyCondition: preferenceCondition,
    purpose: Joi.string(),
    landSize: Joi.string().allow(""),
    minLandSize: Joi.string().allow(""), // For SQM range
    maxLandSize: Joi.string().allow(""), // For SQM range
    measurementUnit: preferenceMeasurementUnit,
    documentTypes: Joi.array().items(preferenceDocumentType).default([]),
    landConditions: Joi.array().items(Joi.string()).default([]),
  }).optional(),

  features: Joi.object({
    baseFeatures: Joi.array().items(Joi.string()).default([]),
    premiumFeatures: Joi.array().items(Joi.string()).default([]),
    autoAdjustToFeatures: Joi.boolean().default(false),
  }).required(),

  contactInfo: Joi.object().required(),
 
  nearbyLandmark: Joi.string().allow(""),
  additionalNotes: Joi.string().allow(""),
  propertyCode: Joi.string().trim().uppercase().allow("").optional(),

  partnerExpectations: Joi.string().allow(""), // For JV only

  status: Joi.string()
    .valid("pending", "approved", "matched", "closed")
    .optional(),

  submittedVia: Joi.string().valid("app", "website").optional(),

  insureSearch: Joi.boolean().optional(),
});
