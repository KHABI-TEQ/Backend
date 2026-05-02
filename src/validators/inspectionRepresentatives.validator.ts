import Joi from "joi";

const MAX_REPRESENTATIVES = 20;

const representativeBodySchema = Joi.object({
  label: Joi.string().trim().max(120).allow("", null),
  email: Joi.alternatives().try(Joi.string().trim().lowercase().email(), Joi.valid("", null)),
  whatsappNumber: Joi.string().trim().max(40).allow("", null),
})
  .custom((value, helpers) => {
    const email = typeof value.email === "string" ? value.email.trim() : "";
    const wa = typeof value.whatsappNumber === "string" ? value.whatsappNumber.trim() : "";
    if (!email && !wa) {
      return helpers.error("any.invalid");
    }
    return {
      ...value,
      label: typeof value.label === "string" ? value.label.trim() || undefined : undefined,
      email: email || undefined,
      whatsappNumber: wa || undefined,
    };
  })
  .messages({
    "any.invalid": "Provide at least one of email or whatsappNumber",
  });

export const addInspectionRepresentativeSchema = representativeBodySchema;

export const updateInspectionRepresentativeSchema = Joi.object({
  label: Joi.string().trim().max(120).allow("", null),
  email: Joi.alternatives().try(Joi.string().trim().lowercase().email(), Joi.valid("", null)),
  whatsappNumber: Joi.string().trim().max(40).allow("", null),
})
  .min(1)
  .messages({
    "object.min": "Provide at least one field to update",
  });

export { MAX_REPRESENTATIVES };
