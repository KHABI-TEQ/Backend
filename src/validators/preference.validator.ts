import Joi from "joi";

export const preferenceValidationSchema = Joi.object({
  preferenceType: Joi.string()
    .valid("buy", "rent", "joint-venture", "shortlet")
    .required(),

  preferenceMode: Joi.string()
    .valid("buy", "tenant", "developer", "shortlet")
    .required(),

  location: Joi.object({
    state: Joi.string().required(),
    localGovernmentAreas: Joi.array().items(Joi.string()).default([]),
    lgasWithAreas: Joi.array()
      .items(
        Joi.object({
          lgaName: Joi.string().required(),
          areas: Joi.array().items(Joi.string()).default([]),
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

  // For Buy & Rent
  propertyDetails: Joi.object({
    propertyType: Joi.string(),
    buildingType: Joi.string(),
    minBedrooms: Joi.string(),
    minBathrooms: Joi.number(),
    leaseTerm: Joi.string(),
    propertyCondition: Joi.string(),
    purpose: Joi.string(),
    landSize: Joi.string(),
    measurementUnit: Joi.string(),
    documentTypes: Joi.array().items(Joi.string()).default([]),
    landConditions: Joi.array().items(Joi.string()).default([]),
  }).optional(),

  // For Joint Venture
  developmentDetails: Joi.object({
    minLandSize: Joi.string(),
    measurementUnit: Joi.string(),
    jvType: Joi.string(),
    propertyType: Joi.string(),
    expectedStructureType: Joi.string(),
    timeline: Joi.string(),
    budgetRange: Joi.string(),
    documentTypes: Joi.array().items(Joi.string()).default([]),
    landConditions: Joi.array().items(Joi.string()).default([]),
    buildingType: Joi.string(),
    propertyCondition: Joi.string(),
    minBedrooms: Joi.string(),
    minBathrooms: Joi.number(),
    purpose: Joi.string(),
  }).optional(),

  // For Shortlet
  bookingDetails: Joi.object({
    propertyType: Joi.string(),
    buildingType: Joi.string(),
    minBedrooms: Joi.string(),
    minBathrooms: Joi.number(),
    numberOfGuests: Joi.number(),
    checkInDate: Joi.date(),
    checkOutDate: Joi.date(),
    travelType: Joi.string(),
    preferredCheckInTime: Joi.string(),
    preferredCheckOutTime: Joi.string(),
    propertyCondition: Joi.string(),
    purpose: Joi.string(),
    landSize: Joi.string().allow(""),
    measurementUnit: Joi.string().allow(""),
    documentTypes: Joi.array().items(Joi.string()).default([]),
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

  partnerExpectations: Joi.string().allow(""), // For JV only

  status: Joi.string()
    .valid("pending", "approved", "matched", "closed")
    .optional(),
});
