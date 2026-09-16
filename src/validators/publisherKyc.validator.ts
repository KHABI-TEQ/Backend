import Joi from "joi";
import { DB } from "../controllers";
import { joiPilotState } from "../common/constants/pilotLocation";

/** KYC payload for Agent, Developer, and Landowner accounts. */
export const publisherKycSchema = Joi.object({
  kycTier: Joi.string().valid("basic", "advanced").optional(),
  advancedKyc: Joi.object({
    companyName: Joi.string().trim().optional().allow(""),
    cacNumber: Joi.string().trim().optional().allow(""),
    projectName: Joi.string().trim().optional().allow(""),
    projectLocation: Joi.string().trim().optional().allow(""),
    projectStage: Joi.string().trim().optional().allow(""),
    expectedCompletion: Joi.string().trim().optional().allow(""),
    supportingDocs: Joi.array().items(Joi.string().uri()).optional(),
  }).optional(),
  meansOfId: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().trim().required().messages({
          "string.empty": "ID name is required.",
        }),
        docImg: Joi.array().items(Joi.string().uri()).min(1).required().messages({
          "array.base": "Document images must be an array of URLs.",
          "array.min": "At least one document image is required.",
        }),
      })
    )
    .min(1)
    .optional()
    .messages({
      "array.min": "At least one means of ID is required.",
    }),

  /** Agent-specific alias; stored as licenseOrRegistrationNumber. */
  agentLicenseNumber: Joi.string().trim().optional().allow(""),
  licenseOrRegistrationNumber: Joi.string().trim().optional().allow(""),
  profileBio: Joi.string().trim().optional().allow(""),
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
        dateAwarded: Joi.date().optional().allow(""),
      })
    )
    .optional()
    .allow(null, ""),

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
    state: joiPilotState(),
    localGovtArea: Joi.string().trim().required().messages({ "string.empty": "Local government area is required." }),
  }).optional(),

  regionOfOperation: Joi.array().items(Joi.string().trim()).optional().messages({
    "array.min": "At least one region of operation is required.",
  }),

  /** Individual or company practitioner. Accept legacy field name agentType. */
  practitionerType: Joi.string().valid("Individual", "Company").optional(),
  agentType: Joi.string().valid("Individual", "Company").optional(),

  companyDetails: Joi.object({
    companyName: Joi.string().trim().optional().allow(""),
    cacNumber: Joi.string().trim().optional().allow(""),
  }).optional(),
})
  .custom((value, helpers) => {
    if (!value.practitionerType && !value.agentType) {
      value.practitionerType = "Individual";
    }
    const type = value.practitionerType || value.agentType;
    if (!type) {
      return helpers.error("any.custom", {
        message: "practitionerType (or agentType) must be Individual or Company.",
      });
    }
    const tier = value.kycTier || "full";
    if (tier !== "basic") {
      if (!value.meansOfId?.length) {
        return helpers.error("any.custom", {
          message: "At least one means of ID is required.",
        });
      }
      if (!value.address?.street || !value.address?.state || !value.address?.localGovtArea) {
        return helpers.error("any.custom", {
          message: "Address is required.",
        });
      }
    }
    if (tier === "advanced") {
      const advanced = value.advancedKyc || {};
      const companyName = value.companyDetails?.companyName || advanced.companyName;
      const cacNumber = value.companyDetails?.cacNumber || advanced.cacNumber;
      if (!companyName || !cacNumber) {
        return helpers.error("any.custom", {
          message: "Company name and CAC number are required for Advanced KYC.",
        });
      }
      if (
        !advanced.projectName ||
        !advanced.projectLocation ||
        !advanced.projectStage ||
        !advanced.expectedCompletion
      ) {
        return helpers.error("any.custom", {
          message: "Project name, location, stage, and expected completion are required for Advanced KYC.",
        });
      }
      if (!advanced.supportingDocs?.length) {
        return helpers.error("any.custom", {
          message: "At least one supporting project document is required for Advanced KYC.",
        });
      }
    }
    return value;
  })
  .messages({
    "any.custom": "{{#message}}",
  });

/** @deprecated Use publisherKycSchema — kept for backward-compatible imports. */
export const agentKycSchema = publisherKycSchema;
