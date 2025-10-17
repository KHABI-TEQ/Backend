import Joi from "joi";

/**
 * Booking Request Validation Schema
 */
export const bookingRequestSchema = Joi.object({
  bookedBy: Joi.object({
    fullName: Joi.string().required().messages({
      "string.base": "Full name must be a string",
      "any.required": "Full name is required",
    }),
    email: Joi.string().email().required().messages({
      "string.email": "Email must be valid",
      "any.required": "Email is required",
    }),
    phoneNumber: Joi.string().required().messages({
      "any.required": "Phone number is required",
    }),
    whatsAppNumber: Joi.string().allow("").optional(),
  }).required(),

  propertyId: Joi.string().required().messages({
    "any.required": "Property ID is required",
  }),

  bookingDetails: Joi.object({
    checkInDateTime: Joi.date().required().messages({
      "date.base": "Check-in date must be a valid date",
      "any.required": "Check-in date is required",
    }),
    checkOutDateTime: Joi.date()
      .greater(Joi.ref("checkInDateTime"))
      .required()
      .messages({
        "date.greater": "Check-out date must be later than check-in date",
        "any.required": "Check-out date is required",
      }),
    guestNumber: Joi.number().integer().min(1).required().messages({
      "number.base": "Guest number must be a number",
      "number.min": "Guest number must be at least 1",
      "any.required": "Guest number is required",
    }),
    note: Joi.string().allow("", null),
  }).required(),

  paymentDetails: Joi.object({
    amountToBePaid: Joi.number().positive().required().messages({
      "number.base": "Amount must be a number",
      "number.positive": "Amount must be greater than 0",
      "any.required": "Payment amount is required",
    }),
  }).required(),

  bookingMode: Joi.string()
    .valid("request", "instant")
    .required()
    .messages({
      "any.only": "Booking mode must be either 'request' or 'instant'",
      "any.required": "Booking mode is required",
    }),
});
