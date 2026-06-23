import Joi from "joi";
import { propertyValidationSchema } from "../utils/formValidation/propertyValidationSchema";

const INSPECTION_FEE_MIN = 1000;
const INSPECTION_FEE_MAX = 50000;
const INSPECTION_FEE_DEFAULT = 5000;

export interface PropertyValidationResult {
  success: boolean;
  data?: any;
  errors?: { field: string; message: string }[];
}

/**
 * Validate property payload at creation. Use this before formatPropertyPayload.
 * Returns normalized payload with inspectionFee clamped to [1000, 50000].
 */
export async function validatePropertyPayload(payload: any): Promise<PropertyValidationResult> {
  try {
    const validated = await propertyValidationSchema.validateAsync(
      normalizePropertyPayload(payload),
      {
      abortEarly: false,
      stripUnknown: true,
      },
    );

    const fee =
      validated.inspectionFee != null
        ? Math.min(INSPECTION_FEE_MAX, Math.max(INSPECTION_FEE_MIN, Number(validated.inspectionFee)))
        : INSPECTION_FEE_DEFAULT;
    validated.inspectionFee = fee;

    return { success: true, data: validated };
  } catch (err: any) {
    if (err?.details) {
      const errors = err.details.map((d: Joi.ValidationErrorItem) => ({
        field: d.path.join("."),
        message: d.message,
      }));
      return { success: false, errors };
    }
    return {
      success: false,
      errors: [{ field: "payload", message: err?.message || "Validation failed" }],
    };
  }
}

export { INSPECTION_FEE_MIN, INSPECTION_FEE_MAX, INSPECTION_FEE_DEFAULT };

function normalizePropertyPayload(payload: any): any {
  const normalized = { ...payload };

  if (normalized.propertyCategory !== "Land" && normalized.landSize) {
    const size = normalized.landSize.size;
    const measurementType = normalized.landSize.measurementType;
    const hasSize =
      size !== "" && size !== null && size !== undefined && Number(size) !== 0;
    const hasMeasurementType = Boolean(measurementType);
    if (!hasSize && !hasMeasurementType) {
      delete normalized.landSize;
    }
  }

  if (!Array.isArray(normalized.docOnProperty)) {
    normalized.docOnProperty = [];
  }

  return normalized;
}
