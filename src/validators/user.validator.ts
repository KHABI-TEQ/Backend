import Joi from "joi";

export const registerUserSchema = Joi.object({
  firstName: Joi.string().trim().required().messages({
    "string.empty": "First name is required.",
  }),
  lastName: Joi.string().trim().required().messages({
    "string.empty": "Last name is required.",
  }),
  email: Joi.string().trim().email().required().messages({
    "string.empty": "Email is required.",
    "string.email": "Please enter a valid email address.",
  }),
  password: Joi.string().min(6).required().messages({
    "string.empty": "Password is required.",
    "string.min": "Password must be at least 6 characters.",
  }),
  userType: Joi.string().trim().valid("User", "Agent", "FieldAgent").required().messages({
    "any.only": "User type must be one of: User, Agent, Agent Field.",
    "string.empty": "User type is required.",
    "any.required": "User type is required.",
  }),
  phoneNumber: Joi.string().trim().required().messages({
    "string.empty": "Phone number is required.",
  }),
  address: Joi.alternatives().try(
    Joi.string().required(),
    Joi.object().required()
  ).messages({
    "any.required": "Address is required.",
  }),
  referreredCode: Joi.string().optional(),
});

export const oauthRegisterSchema = Joi.object({
  idToken: Joi.string().trim().required().messages({
    "string.empty": "ID token is required.",
    "any.required": "ID token is required.",
  }),
  userType: Joi.string().trim().valid("User", "Agent", "FieldAgent").required().messages({
    "any.only": "User type must be one of: User, Agent, Agent Field.",
    "string.empty": "User type is required.",
    "any.required": "User type is required.",
  }),
  referreredCode: Joi.string().optional(),
});
