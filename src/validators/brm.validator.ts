import Joi from "joi";

export const createBrmSchema = Joi.object({
  fullName: Joi.string().trim().required(),
  profilePicture: Joi.string().trim().min(1).required(),
  phoneNumber: Joi.string().trim().required(),
  gender: Joi.string().valid("male", "female", "other").required(),
  serviceMessage: Joi.string().trim().min(10).max(500).required(),
  isActive: Joi.boolean().optional(),
});

export const updateBrmSchema = Joi.object({
  fullName: Joi.string().trim().optional(),
  profilePicture: Joi.string().trim().min(1).optional(),
  phoneNumber: Joi.string().trim().optional(),
  gender: Joi.string().valid("male", "female", "other").optional(),
  serviceMessage: Joi.string().trim().min(10).max(500).optional(),
  isActive: Joi.boolean().optional(),
}).min(1);

export const assignBrmSchema = Joi.object({
  brmId: Joi.string().trim().allow(null, "").optional(),
});
