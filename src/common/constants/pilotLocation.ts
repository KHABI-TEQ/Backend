import Joi from "joi";

/** Canonical pilot market. All listing, preference, and related submits must use this state. */
export const PILOT_STATE = "Lagos";
export const PILOT_STATE_LABEL = "Lagos State";

export const PILOT_LOCATION_MESSAGE =
  "Khabiteq is currently piloting in Lagos State only. Please choose a Lagos location.";

export function normalizeLocationName(value?: string | null): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function isPilotState(value?: string | null): boolean {
  const normalized = normalizeLocationName(value);
  if (!normalized) return false;
  return (
    normalized === "lagos" ||
    normalized === "lagos state" ||
    normalized === "lagos-state"
  );
}

/** Store a single canonical value so matching and filters stay consistent. */
export function canonicalizePilotState(value?: string | null): string | null {
  return isPilotState(value) ? PILOT_STATE : null;
}

export function joiPilotState(options?: { required?: boolean }) {
  const required = options?.required !== false;
  const schema = Joi.string()
    .trim()
    .custom((value, helpers) => {
      if (!value) {
        return required ? helpers.error("any.required") : value;
      }
      if (!isPilotState(value)) {
        return helpers.error("any.custom");
      }
      return PILOT_STATE;
    })
    .messages({
      "any.required": PILOT_LOCATION_MESSAGE,
      "string.empty": PILOT_LOCATION_MESSAGE,
      "any.custom": PILOT_LOCATION_MESSAGE,
    });

  return required ? schema.required() : schema.allow("", null).optional();
}

/** Mongo filter that matches stored "Lagos" or "Lagos State". */
export function mongoPilotStateClause(field = "location.state") {
  return { [field]: { $regex: /^(lagos)(\s+state)?$/i } };
}
