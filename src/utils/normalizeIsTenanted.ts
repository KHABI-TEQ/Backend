/**
 * API clients often send "Yes" / "No"; Mongoose Property.isTenanted enum is
 * "yes" | "no" | "i-live-in-it".
 */
export function normalizeIsTenantedForDb(
  value: unknown
): "yes" | "no" | "i-live-in-it" {
  const raw = String(value ?? "no").trim().toLowerCase();
  const compact = raw.replace(/[_\s]+/g, "-");

  if (compact === "yes") return "yes";
  if (compact === "i-live-in-it" || compact === "iliveinit") {
    return "i-live-in-it";
  }
  return "no";
}
