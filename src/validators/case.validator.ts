import Joi from "joi";

export const createPetitionSchema = Joi.object({
  registrationId: Joi.string().hex().length(24).required(),
  subject: Joi.string().min(5).max(200).trim().required(),
  description: Joi.string().min(10).max(5000).trim().required(),
  amountInvolved: Joi.number().positive().required(),
  respondent: Joi.object({
    name: Joi.string().min(2).max(200).trim().required(),
    email: Joi.string().email().trim().allow("", null).optional(),
    phoneNumber: Joi.string().trim().max(20).allow("", null).optional(),
    type: Joi.string().valid("developer", "agent", "property_owner", "other").required(),
  }).required(),
  attachments: Joi.array().items(
    Joi.object({
      fileName: Joi.string().required(),
      url: Joi.string().uri().required(),
    })
  ).optional(),
});

export const openCaseSchema = Joi.object({
  assignedOfficer: Joi.string().hex().length(24).optional(),
  reviewNotes: Joi.string().trim().max(2000).allow("", null).optional(),
});

export const updateCaseStatusSchema = Joi.object({
  status: Joi.string().valid("mediation", "closed").required(),
  reason: Joi.string().trim().max(500).allow("", null).optional(),
});

export const assignOfficerSchema = Joi.object({
  officerId: Joi.string().hex().length(24).required(),
});

export const saveMediationNoteSchema = Joi.object({
  meetingNotes: Joi.string().trim().max(5000).allow("", null).optional(),
  partyResponses: Joi.string().trim().max(5000).allow("", null).optional(),
  proposedResolution: Joi.string().trim().max(5000).allow("", null).optional(),
  outcome: Joi.string().trim().max(2000).allow("", null).optional(),
  attachments: Joi.array().items(
    Joi.object({
      fileName: Joi.string().trim().required(),
      url: Joi.string().uri().required(),
    })
  ).optional(),
}).or("meetingNotes", "partyResponses", "proposedResolution", "outcome");

export const sendRequestInfoSchema = Joi.object({
  message: Joi.string().min(10).max(3000).trim().required(),
});

export const efccTransferSchema = Joi.object({
  efccEmail: Joi.string().email().required(),
  confirmEmail: Joi.string().email().valid(Joi.ref("efccEmail")).required()
    .messages({ "any.only": "Email addresses must match" }),
  idempotencyKey: Joi.string().max(100).required(),
});

export const closeCaseSchema = Joi.object({
  outcome: Joi.string().valid("resolved", "withdrawn", "dismissed", "referred_closed").required(),
  summary: Joi.string().trim().min(10).max(2000).required(),
});

export const respondToCommSchema = Joi.object({
  message: Joi.string().min(5).max(3000).trim().required(),
  attachments: Joi.array().items(
    Joi.object({
      fileName: Joi.string().required(),
      url: Joi.string().uri().required(),
    })
  ).optional(),
});
