import Joi from "joi";
import { PROFESSIONAL_UPGRADE_TYPES } from "../services/professionalUpgrade.service";

export const applyProfessionalUpgradeSchema = Joi.object({
  professionalType: Joi.string()
    .valid(...PROFESSIONAL_UPGRADE_TYPES)
    .required()
    .messages({
      "any.only": "Professional type must be Agent, Developer, Lawyer, Surveyor, or Valuer.",
      "any.required": "Professional type is required.",
    }),
});
