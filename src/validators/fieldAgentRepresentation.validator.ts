import Joi from "joi";

export const requestFieldAgentSchema = Joi.object({
  fieldAgentUserId: Joi.string().trim().required().messages({
    "any.required": "fieldAgentUserId is required",
  }),
  note: Joi.string().trim().max(500).optional().allow(""),
  acknowledgedCommissionTerms: Joi.boolean().valid(true).required().messages({
    "any.only":
      "You must acknowledge the commission terms before requesting a Field Agent.",
  }),
});

export const respondFieldAgentRepresentationSchema = Joi.object({
  action: Joi.string().valid("accept", "reject").required(),
  note: Joi.string().trim().max(500).optional().allow(""),
});
