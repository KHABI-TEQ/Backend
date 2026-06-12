const NG_LOCAL_RE = /^0[789][01]\d{8}$/;

export function normalizeNigerianPhoneNumber(input: string): string | null {
  let s = input.replace(/[\s-]/g, "").trim();
  if (!s) return null;
  if (s.startsWith("+234")) s = "0" + s.slice(4);
  else if (s.startsWith("234")) s = "0" + s.slice(3);
  if (!NG_LOCAL_RE.test(s)) return null;
  return s;
}

export function parseNigerianPhoneFromText(text: string): string | null {
  if (!text || typeof text !== "string") return null;
  const m = text.trim().match(/(?:\+?234|0)[789][01]\d{8}\b/);
  if (!m) return null;
  return normalizeNigerianPhoneNumber(m[0].replace(/\s/g, ""));
}
