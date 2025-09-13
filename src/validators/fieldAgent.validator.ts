import Joi from "joi";

export const createFieldAgentSchema = Joi.object({
  // Required user fields
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  phoneNumber: Joi.string().required(),

  // Optional fields
  whatsappNumber: Joi.string().allow("").optional(),

  address: Joi.object({
    street: Joi.string().allow("").optional(),
    homeNo: Joi.string().allow("").optional(),
    state: Joi.string().allow("").optional(),
    localGovtArea: Joi.string().allow("").optional(), // ✅ fixed
  }).optional(),

  govtId: Joi.object({
    typeOfId: Joi.string().valid(
      "national-id",
      "voter-card",
      "international-passport",
      "drivers-license"
    ).allow("").optional(),
    idNumber: Joi.string().allow("").optional(),
    docImg: Joi.array().items(Joi.string().uri()).optional(),
  }).optional(),

  utilityBill: Joi.object({
    name: Joi.string().allow("").optional(),
    docImg: Joi.array().items(Joi.string().uri()).optional(),
  }).optional(),

  regionOfOperation: Joi.array().items(Joi.string()).optional(), // ✅ removed min(1)

  guarantors: Joi.array().items(
    Joi.object({
      fullName: Joi.string().allow("").optional(),
      phoneNumber: Joi.string().allow("").optional(),
      relationship: Joi.string().allow("").optional(),
      address: Joi.string().allow("").optional(),
    })
  ).optional(), // ✅ removed min(1)

  isFlagged: Joi.boolean().optional(),
  accountApproved: Joi.boolean().optional(),
});
