import Joi from "joi";
import { listingCommissionFields } from "../common/constants/listingCommission";
import { propertyValidationSchema } from "../utils/formValidation/propertyValidationSchema";

const INSPECTION_FEE_MIN = 1000;
const INSPECTION_FEE_MAX = 50000;
/** 0 means the listing agent did not set an inspection fee. */
const INSPECTION_FEE_DEFAULT = 0;

/** Persist only an agent-set fee. Empty/0/null stays 0 (no fee). */
export function optionalInspectionFeeNaira(value: unknown): number {
  if (value == null || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(INSPECTION_FEE_MAX, Math.max(INSPECTION_FEE_MIN, Math.round(n)));
}

export interface PropertyValidationResult {
  success: boolean;
  data?: any;
  errors?: { field: string; message: string }[];
}

/**
 * Validate property payload at creation. Use this before formatPropertyPayload.
 * Returns normalized payload. Inspection fee is optional; unset stays 0.
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

    validated.inspectionFee = optionalInspectionFeeNaira(validated.inspectionFee);

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

  Object.assign(normalized, listingCommissionFields(normalized));

  return normalized;
}
