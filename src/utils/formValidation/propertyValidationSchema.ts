import Joi from "joi";

export const propertyValidationSchema = Joi.object({
  propertyType: Joi.string().valid("sell", "rent", "shortlet", "jv").required(),
  propertyCategory: Joi.string().required(),

  propertyCondition: Joi.string().when("propertyCategory", {
    is: Joi.not("Land"),
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  typeOfBuilding: Joi.string().when("propertyCategory", {
    is: Joi.not("Land"),
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  rentalType: Joi.string().when("propertyType", {
    is: "rent",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  shortletDuration: Joi.string().when("propertyType", {
    is: "shortlet",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  holdDuration: Joi.string().when("propertyType", {
    is: "jv",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  price: Joi.number().required(),

  location: Joi.object({
    state: Joi.string().required(),
    localGovernment: Joi.string().required(),
    area: Joi.string().required(),
  }).required(),

  landSize: Joi.object({
    measurementType: Joi.string().required(),
    size: Joi.number().required(),
  }).required(),

  docOnProperty: Joi.array()
    .items(
      Joi.object({
        docName: Joi.string().required(),
        isProvided: Joi.boolean().required(),
      }),
    )
    .min(1)
    .required(),

  owner: Joi.string().required(),

  areYouTheOwner: Joi.boolean().required(),

  features: Joi.array().items(Joi.string()).default([]),

  tenantCriteria: Joi.array().items(Joi.string()).default([]),

  additionalFeatures: Joi.object({
    noOfBedroom: Joi.number().default(0),
    noOfBathroom: Joi.number().default(0),
    noOfToilet: Joi.number().default(0),
    noOfCarPark: Joi.number().default(0),
  }).required(),

  jvConditions: Joi.when("propertyType", {
    is: "jv",
    then: Joi.array().items(Joi.string()).min(1).required(),
    otherwise: Joi.array().items(Joi.string()).optional(),
  }),

  shortletDetails: Joi.object().when("propertyType", {
    is: "shortlet",
    then: Joi.object({
      streetAddress: Joi.string().required(),
      maxGuests: Joi.number().required(),
      availability: Joi.object({
        minStay: Joi.number().required(),
      }).required(),
      pricing: Joi.object({
        nightly: Joi.number().required(),
        weeklyDiscount: Joi.number().default(0),
      }).required(),
      houseRules: Joi.object({
        checkIn: Joi.string().required(),
        checkOut: Joi.string().required(),
      }).required(),
    }).required(),
    otherwise: Joi.optional(),
  }),

  pictures: Joi.array().items(Joi.string()).default([]),

  videos: Joi.array().items(Joi.string()).default([]),

  description: Joi.string().required(),

  addtionalInfo: Joi.string().allow("").optional(),

  isTenanted: Joi.string().valid("Yes", "No").required(),

  status: Joi.string()
    .valid(
      "rejected",
      "approved",
      "pending",
      "deleted",
      "flagged",
      "sold",
      "active",
      "contingent",
      "under_contract",
      "coming_soon",
      "expired",
      "withdrawn",
      "cancelled",
      "back_on_market",
      "temporarily_off_market",
      "hold",
      "failed",
      "never_listed",
    )
    .default("pending"),

  reason: Joi.string().optional(),

  createdByRole: Joi.string().valid("user", "admin").required(),
});
