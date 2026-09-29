/** Render stored inspection times as compact local clock labels (for example, 2:00pm). */
export function formatInspectionTime(value?: unknown): string {
  if (value == null || value === "") return "";
  const raw = String(value).trim();
  const clock = raw.match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (clock) {
    let hour = Number(clock[1]);
    const minute = clock[2];
    let suffix = clock[3]?.toLowerCase();
    if (!suffix) {
      suffix = hour >= 12 ? "pm" : "am";
      hour = hour % 12 || 12;
    }
    return `${hour}:${minute}${suffix}`;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("en-NG", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos",
  }).format(date).replace(/\s/g, "").toLowerCase();
}

/** Copy an email payload while humanizing each time value it contains. */
export function formatInspectionTimesIn<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => formatInspectionTimesIn(item)) as T;
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  const formatted: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    formatted[key] = /time/i.test(key) && typeof item === "string"
      ? formatInspectionTime(item)
      : formatInspectionTimesIn(item);
  }
  return formatted as T;
}
