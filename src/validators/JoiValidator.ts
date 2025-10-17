import Joi from "joi";

export interface ValidationResult<T> {
  success: boolean;
  data: T | null;
  errors: { field: string; message: string }[];
}

export class JoiValidator {
  static validate<T>(schema: Joi.ObjectSchema<T>, payload: any): ValidationResult<T> {
    const { error, value } = schema.validate(payload, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return {
        success: false,
        data: null,  // now properly typed
        errors: error.details.map((d) => ({
          field: d.path.join("."), // e.g. requestedBy.email
          message: d.message,
        })),
      };
    }

    return {
      success: true,
      data: value as T,
      errors: [],
    };
  }
}
