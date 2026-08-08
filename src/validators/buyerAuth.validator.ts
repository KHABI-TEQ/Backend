import Joi from "joi";

export const registerBuyerSchema = Joi.object({
  fullName: Joi.string().trim().required().messages({
    "string.empty": "Full name is required.",
    "any.required": "Full name is required.",
  }),
  phoneNumber: Joi.string().trim().required().messages({
    "string.empty": "Phone number is required.",
    "any.required": "Phone number is required.",
  }),
  email: Joi.string().trim().email().required().messages({
    "string.empty": "Email is required.",
    "string.email": "Please enter a valid email address.",
    "any.required": "Email is required.",
  }),
  password: Joi.string().min(6).required().messages({
    "string.empty": "Password is required.",
    "string.min": "Password must be at least 6 characters.",
    "any.required": "Password is required.",
  }),
});

export const loginBuyerSchema = Joi.object({
  email: Joi.string().trim().email().required().messages({
    "string.empty": "Email is required.",
    "string.email": "Please enter a valid email address.",
    "any.required": "Email is required.",
  }),
  password: Joi.string().required().messages({
    "string.empty": "Password is required.",
    "any.required": "Password is required.",
  }),
});

export const buyerEmailSchema = Joi.object({
  email: Joi.string().trim().email().required().messages({
    "string.empty": "Email is required.",
    "string.email": "Please enter a valid email address.",
    "any.required": "Email is required.",
  }),
});

export const verifyBuyerResetCodeSchema = Joi.object({
  email: Joi.string().trim().email().required(),
  token: Joi.string().trim().required().messages({
    "string.empty": "Reset code is required.",
    "any.required": "Reset code is required.",
  }),
});

export const resetBuyerPasswordSchema = Joi.object({
  email: Joi.string().trim().email().required(),
  token: Joi.string().trim().required(),
  newPassword: Joi.string().min(6).required().messages({
    "string.min": "Password must be at least 6 characters.",
    "any.required": "New password is required.",
  }),
});

export const upsertDeviceTokenSchema = Joi.object({
  token: Joi.string().trim().required().messages({
    "string.empty": "FCM token is required.",
    "any.required": "FCM token is required.",
  }),
  deviceId: Joi.string().trim().required().messages({
    "string.empty": "Device ID is required.",
    "any.required": "Device ID is required.",
  }),
  platform: Joi.string().trim().valid("ios", "android", "web").optional(),
});

export const removeDeviceTokenSchema = Joi.object({
  deviceId: Joi.string().trim().required().messages({
    "string.empty": "Device ID is required.",
    "any.required": "Device ID is required.",
  }),
});
