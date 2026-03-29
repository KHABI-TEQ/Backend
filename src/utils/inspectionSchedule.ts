import moment from "moment";

/**
 * Combine stored inspectionDate (Date) and inspectionTime (free-form string) into one Date.
 * Uses moment strict parsing with common formats; falls back to loose parse.
 */
export function parseInspectionScheduledAt(inspectionDate: Date, inspectionTime: string): Date | null {
  if (!inspectionDate || !inspectionTime?.trim()) return null;
  const datePart = moment(inspectionDate).format("YYYY-MM-DD");
  const combined = `${datePart} ${inspectionTime.trim()}`;
  const formats = [
    "YYYY-MM-DD HH:mm",
    "YYYY-MM-DD H:mm",
    "YYYY-MM-DD hh:mm A",
    "YYYY-MM-DD h:mm A",
    "YYYY-MM-DD hh:mm:ss A",
    "YYYY-MM-DD h:mm:ss A",
    "YYYY-MM-DD HH:mm:ss",
  ];
  const strict = moment(combined, formats, true);
  if (strict.isValid()) return strict.toDate();
  const loose = moment(combined);
  return loose.isValid() ? loose.toDate() : null;
}
