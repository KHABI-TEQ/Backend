import Joi from "joi";
import { DB } from "../controllers";

export const agentKycSchema = Joi.object({
  meansOfId: Joi.array().items(
    Joi.object({
      name: Joi.string().trim().required().messages({
        "string.empty": "ID name is required.",
      }),
      docImg: Joi.array().items(Joi.string().uri()).min(1).required().messages({
        "array.base": "Document images must be an array of URLs.",
        "array.min": "At least one document image is required.",
      }),
    })
  ).min(1).required().messages({
    "array.min": "At least one means of ID is required.",
    "any.required": "Means of ID is required.",
  }),

  agentLicenseNumber: Joi.string().trim().optional().allow(""),
  profileBio: Joi.string().trim().optional(),
  specializations: Joi.array().items(Joi.string().trim()).optional(),
  languagesSpoken: Joi.array().items(Joi.string().trim()).optional(),
  servicesOffered: Joi.array().items(Joi.string().trim()).optional(),

  achievements: Joi.array()
    .items(
      Joi.object({
        title: Joi.string().trim().required().messages({
          "string.empty": "Achievement title is required.",
        }),
        description: Joi.string().trim().optional().allow(""),
        fileUrl: Joi.string().uri().optional().allow(""),
        dateAwarded: Joi.date().optional(),
      })
    )
    .optional()
    .allow(null, ""), // ✅ now truly optional

  featuredListings: Joi.array()
    .items(
      Joi.string()
        .hex()
        .length(24)
        .custom(async (value, helpers) => {
          const exists = await DB.Models.Property.exists({ _id: value });
          if (!exists) {
            return helpers.error("any.custom", { value });
          }
          return value;
        })
    )
    .optional()
    .messages({
      "string.hex": "Featured listing must be a valid property ID.",
      "string.length": "Featured listing must be a valid 24-character ObjectId.",
      "any.custom": "Property ID does not exist in the database.",
    }),

  address: Joi.object({
    street: Joi.string().trim().required().messages({ "string.empty": "Street is required." }),
    homeNo: Joi.string().trim().required().messages({ "string.empty": "Home number is required." }),
    state: Joi.string().trim().required().messages({ "string.empty": "State is required." }),
    localGovtArea: Joi.string().trim().required().messages({ "string.empty": "Local government area is required." }),
  }).required().messages({ "any.required": "Address is required." }),

  regionOfOperation: Joi.array().items(Joi.string().trim()).min(1).required().messages({
    "array.min": "At least one region of operation is required.",
    "any.required": "Region of operation is required.",
  }),

  agentType: Joi.string().valid("Individual", "Company").required().messages({
    "any.only": "Agent type must be either 'Individual' or 'Company'.",
    "any.required": "Agent type is required.",
  }),
});