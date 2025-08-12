import Joi from 'joi';

export const createFieldAgentSchema = Joi.object({
  // User fields
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  phoneNumber: Joi.string().required(),

  // Field Agent fields
  whatsappNumber: Joi.string().optional(),

  address: Joi.object({
    street: Joi.string().optional(),
    homeNo: Joi.string().optional(),
    state: Joi.string().optional(),
    localGovtArea: Joi.string().optional(),
  }).required(),

  govtId: Joi.object({
    typeOfId: Joi.string()
      .valid('national-id', 'voter-card', 'international-passport', 'drivers-license')
      .optional(),
    idNumber: Joi.string().allow("").optional(),
    docImg: Joi.array().items(Joi.string().uri()).optional(),
  }).optional(),

  utilityBill: Joi.object({
    name: Joi.string().allow("").optional(),
    docImg: Joi.array().items(Joi.string().uri()).optional(),
  }).optional(),

  regionOfOperation: Joi.array().items(Joi.string()).min(1).optional(),

  guarantors: Joi.array()
    .items(
      Joi.object({
        fullName: Joi.string().optional(),
        phoneNumber: Joi.string().optional(),
        relationship: Joi.string().optional(),
        address: Joi.string().optional(),
      })
    )
    .min(1)
    .optional(),

  isFlagged: Joi.boolean().optional(),
  accountApproved: Joi.boolean().optional(),
});
