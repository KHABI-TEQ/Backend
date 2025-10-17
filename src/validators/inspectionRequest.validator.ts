import Joi from "joi";

export const submitInspectionSchema = Joi.object({
  requestedBy: Joi.object({
    fullName: Joi.string().trim().min(2).max(100).required(),
    phoneNumber: Joi.string().trim().required(),
    email: Joi.string().email().required(),
    whatsAppNumber: Joi.string().trim().allow(null, "").optional()
  }).required(),

  inspectionDetails: Joi.object({
    inspectionDate: Joi.string().trim().required(), // you can switch to Joi.date() if you want stricter
    inspectionTime: Joi.string().trim().required(),
    inspectionMode: Joi.string().valid("in_person", "virtual").required()
  }).required(),

  inspectionAmount: Joi.number().positive().required(),

  properties: Joi.array()
    .items(
      Joi.object({
        propertyId: Joi.string().required(),
        inspectionType: Joi.string().valid("price", "LOI").required(),
        negotiationPrice: Joi.number().positive().optional().allow(null, ""),
        letterOfIntention: Joi.any().optional().allow(null, ""),
        inspectionDate: Joi.any().optional().allow(null, ""),
        inspectionTime: Joi.any().optional().allow(null, ""),

        // 🔹 requestSource is optional
        requestSource: Joi.object({
          page: Joi.string()
            .valid("market-place", "home-page", "matched-properties")
            .required(),
          matchedId: Joi.string().allow("", null).optional(),
          preferenceId: Joi.string().allow("", null).optional()
        }).optional().allow(null)
      })
    )
    .min(1)
    .required()
});
