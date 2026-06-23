import Joi from "joi";

const roomCount = Joi.alternatives().try(Joi.number(), Joi.string()).optional();

export const propertyValidationSchema = Joi.object({
  propertyType: Joi.string().valid("sell", "rent", "shortlet", "jv", "off-plan").required(),
  propertyCategory: Joi.string().required(),

  // Required for Residential/Commercial sell & rent; optional for shortlet, JV, and Land
  propertyCondition: Joi.string()
    .trim()
    .allow("", null)
    .when("propertyCategory", {
      is: Joi.string().valid("Residential", "Commercial"),
      then: Joi.when("propertyType", {
        is: Joi.valid("shortlet", "jv"),
        then: Joi.optional(),
        otherwise: Joi.required(),
      }),
      otherwise: Joi.optional(),
    }),

  typeOfBuilding: Joi.string().when("propertyCategory", {
    is: Joi.string().valid("Residential", "Commercial"),
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
    streetAddress: Joi.string().trim().allow("").optional(),
  }).required(),

  landSize: Joi.when("propertyCategory", {
    is: "Land",
    then: Joi.object({
      measurementType: Joi.string().required(),
      size: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
    }).required(),
    otherwise: Joi.object({
      measurementType: Joi.string().allow("", null).optional(),
      size: Joi.alternatives().try(Joi.number(), Joi.string()).allow("", null).optional(),
    }).optional(),
  }),

  docOnProperty: Joi.array()
    .items(
      Joi.object({
        docName: Joi.string().required(),
        isProvided: Joi.boolean().required(),
      }),
    )
    .default([]),

  owner: Joi.string().optional(), // Set by server from authenticated user

  areYouTheOwner: Joi.boolean().required(),

  ownershipDocuments: Joi.array().items(Joi.object().unknown(true)).optional(),

  features: Joi.array().items(Joi.string()).default([]),

  tenantCriteria: Joi.array().items(Joi.string()).default([]),

  additionalFeatures: Joi.object({
    noOfBedroom: roomCount,
    noOfBathroom: roomCount,
    noOfToilet: roomCount,
    noOfCarPark: roomCount,
    noOfSittingRoom: roomCount,
  }).required(),

  /** Off-plan only */
  expectedCompletionDate: Joi.string().trim().allow("").when("propertyType", {
    is: "off-plan",
    then: Joi.optional(),
    otherwise: Joi.forbidden(),
  }),
  developmentStage: Joi.string().trim().allow("").when("propertyType", {
    is: "off-plan",
    then: Joi.optional(),
    otherwise: Joi.forbidden(),
  }),
  paymentPlan: Joi.string().trim().allow("").when("propertyType", {
    is: "off-plan",
    then: Joi.optional(),
    otherwise: Joi.forbidden(),
  }),
  briefType: Joi.string().trim().optional(),

  jvConditions: Joi.when("propertyType", {
    is: "jv",
    then: Joi.array().items(Joi.string()).min(1).required(),
    otherwise: Joi.array().items(Joi.string()).optional(),
  }),

  shortletDetails: Joi.when("propertyType", {
    is: "shortlet",
    then: Joi.object({
      streetAddress: Joi.string().allow("").optional(),
      maxGuests: Joi.number().optional(),
      availability: Joi.object({
        minStay: Joi.number().optional(),
      }).optional(),
      pricing: Joi.object({
        nightly: Joi.number().optional(),
        weeklyDiscount: Joi.number().default(0),
      }).optional(),
      houseRules: Joi.object({
        checkIn: Joi.string().optional(),
        checkOut: Joi.string().optional(),
      }).optional(),
    }).optional(),
    otherwise: Joi.optional(),
  }),

  /** Shortlet listings submit these at the top level (see formatShortletProperty). */
  availability: Joi.when("propertyType", {
    is: "shortlet",
    then: Joi.object({
      minStay: Joi.number().optional(),
      maxStay: Joi.number().optional(),
      calendar: Joi.any().optional(),
    }).optional(),
    otherwise: Joi.forbidden(),
  }),

  pricing: Joi.when("propertyType", {
    is: "shortlet",
    then: Joi.object({
      nightly: Joi.number().optional(),
      weeklyDiscount: Joi.number().optional(),
      monthlyDiscount: Joi.number().optional(),
      cleaningFee: Joi.number().optional(),
      securityDeposit: Joi.number().optional(),
      cancellationPolicy: Joi.string().optional(),
    }).optional(),
    otherwise: Joi.forbidden(),
  }),

  houseRules: Joi.when("propertyType", {
    is: "shortlet",
    then: Joi.object({
      checkIn: Joi.string().optional(),
      checkOut: Joi.string().optional(),
      smoking: Joi.boolean().optional(),
      pets: Joi.boolean().optional(),
      parties: Joi.boolean().optional(),
      otherRules: Joi.string().allow("").optional(),
    }).optional(),
    otherwise: Joi.forbidden(),
  }),

  pictures: Joi.array().items(Joi.string()).default([]),

  videos: Joi.array().items(Joi.string()).default([]),

  description: Joi.string().trim().allow("", null).optional().default(""),

  addtionalInfo: Joi.string().trim().allow("", null).optional().default(""),

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

  /** Inspection fee in Naira. Min ₦1,000, max ₦50,000. */
  inspectionFee: Joi.number().min(1000).max(50000).default(5000).optional(),

  /** Only Landlords and Developers may set "lasrera_marketplace" (property visible only on LASRERA Market Place, no contact). */
  listingScope: Joi.string().valid("agent_listing", "lasrera_marketplace").default("agent_listing").optional(),

  /** Agent commission: 0–5%. Accepted for Sale, Rent, JV, Shortlet, Off-plan (Landlord/Developer). */
  agentCommissionPercent: Joi.number().min(0).max(5).optional(),
  /** Agent commission amount in Naira. */
  agentCommissionAmount: Joi.number().min(0).optional(),

  createdByRole: Joi.string().valid("user", "admin").optional(),
})
  .custom((value, helpers) => {
    const pictures = Array.isArray(value.pictures) ? value.pictures.filter(Boolean) : [];
    const videos = Array.isArray(value.videos) ? value.videos.filter(Boolean) : [];

    if (pictures.length === 0 && videos.length === 0) {
      return helpers.error("any.custom", {
        message: "At least one media is required: provide at least one image or one video.",
      });
    }

    return value;
  }, "property media presence validation")
  .messages({
    "any.custom": "{{#message}}",
  });
