import Joi from 'joi';

export const createFieldAgentSchema = Joi.object({
  // User fields
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  phoneNumber: Joi.string().required(),

  // Field Agent fields
  whatsappNumber: Joi.string().required(),

  address: Joi.object({
    street: Joi.string().optional(),
    homeNo: Joi.string().optional(),
    state: Joi.string().required(),
    localGovtArea: Joi.string().required(),
  }).required(),

  govtId: Joi.object({
    typeOfId: Joi.string()
      .valid('national-id', 'voter-card', 'international-passport', 'drivers-license')
      .required(),
    idNumber: Joi.string().required(),
    docImg: Joi.array().items(Joi.string().uri()).optional(),
  }).optional(),

  utilityBill: Joi.object({
    name: Joi.string().required(),
    docImg: Joi.array().items(Joi.string().uri()).optional(),
  }).optional(),

  regionOfOperation: Joi.array().items(Joi.string()).min(1).required(),

  guarantors: Joi.array()
    .items(
      Joi.object({
        fullName: Joi.string().required(),
        phoneNumber: Joi.string().required(),
        relationship: Joi.string().optional(),
        address: Joi.string().optional(),
      })
    )
    .min(1)
    .optional(),

  isFlagged: Joi.boolean().optional(),
  accountApproved: Joi.boolean().optional(),
});
