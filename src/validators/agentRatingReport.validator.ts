import Joi from "joi";

const reportCategories = [
  "unprofessional_conduct",
  "property_misrepresentation",
  "no_show_or_late",
  "payment_issue",
  "safety_concern",
  "communication_issue",
  "other",
] as const;

export const submitRatingSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required().messages({
    "number.min": "Rating must be between 1 and 5",
    "number.max": "Rating must be between 1 and 5",
  }),
  comment: Joi.string().trim().max(1000).allow("", null).optional(),
});

/** Public (no auth): buyer identified by email from inspection record */
export const submitRatingSchemaPublic = Joi.object({
  email: Joi.string().email().required(),
  rating: Joi.number().integer().min(1).max(5).required().messages({
    "number.min": "Rating must be between 1 and 5",
    "number.max": "Rating must be between 1 and 5",
  }),
  comment: Joi.string().trim().max(1000).allow("", null).optional(),
});

export const submitReportSchema = Joi.object({
  category: Joi.string()
    .valid(...reportCategories)
    .required()
    .messages({
      "any.only": `Category must be one of: ${reportCategories.join(", ")}`,
    }),
  subject: Joi.string().trim().max(200).allow("", null).optional(),
  description: Joi.string().trim().min(10).max(2000).required().messages({
    "string.min": "Description must be at least 10 characters",
    "string.max": "Description must not exceed 2000 characters",
  }),
});

/** Public (no auth): buyer identified by email from inspection record */
export const submitReportSchemaPublic = Joi.object({
  email: Joi.string().email().required(),
  category: Joi.string()
    .valid(...reportCategories)
    .required()
    .messages({
      "any.only": `Category must be one of: ${reportCategories.join(", ")}`,
    }),
  subject: Joi.string().trim().max(200).allow("", null).optional(),
  description: Joi.string().trim().min(10).max(2000).required().messages({
    "string.min": "Description must be at least 10 characters",
    "string.max": "Description must not exceed 2000 characters",
  }),
});
