/** Nigerian phone normalization and lookup variants (080…, 23480…, etc.). */

const DEFAULT_COUNTRY_CODE = (process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "234").replace(/\D/g, "");

export function digitsOnly(phone: string): string {
  return String(phone || "").replace(/\D/g, "");
}

/** Normalize to E.164 digits without leading + (e.g. 2348031234567). */
export function normalizeNigerianPhone(phone: string): string | null {
  const input = String(phone || "").trim();
  if (!input) return null;

  let digits = digitsOnly(input);
  if (!digits) return null;

  if (input.startsWith("+")) {
    return digits;
  }
  if (input.startsWith("00")) {
    return digits.slice(2);
  }
  if (digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    return digits;
  }
  if (digits.startsWith("0") && digits.length === 11) {
    return `${DEFAULT_COUNTRY_CODE}${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `${DEFAULT_COUNTRY_CODE}${digits}`;
  }
  return digits.length >= 10 ? digits : null;
}

/** Build common stored formats for MongoDB $in queries. */
export function phoneVariantsForLookup(phone: string): string[] {
  const normalized = normalizeNigerianPhone(phone);
  if (!normalized) return [];

  const national = normalized.startsWith(DEFAULT_COUNTRY_CODE)
    ? `0${normalized.slice(DEFAULT_COUNTRY_CODE.length)}`
    : normalized;

  const variants = new Set<string>([
    phone.trim(),
    normalized,
    `+${normalized}`,
    national,
    `0${normalized.slice(DEFAULT_COUNTRY_CODE.length)}`,
  ]);

  return [...variants].filter(Boolean);
}

export function maskPhoneForDisplay(phone: string): string {
  const digits = digitsOnly(phone);
  if (digits.length < 7) return digits;
  return `${digits.slice(0, 4)}****${digits.slice(-3)}`;
}
