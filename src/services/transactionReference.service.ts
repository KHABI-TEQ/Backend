import { DB } from "../controllers";

const PREFIX = "KHT-TR-";

export function normalizeTransactionReference(value: string): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function isTransactionReference(value: string): boolean {
  return /^KHT-TR-\d{6,}$/.test(normalizeTransactionReference(value));
}

export async function generateUniqueTransactionReference(): Promise<string> {
  const latest = await DB.Models.TransactionRegistration.findOne({
    transactionReference: { $regex: `^${PREFIX}\\d+$` },
  })
    .sort({ transactionReference: -1 })
    .select("transactionReference")
    .lean();

  const lastSeq = latest?.transactionReference
    ? Number(String(latest.transactionReference).replace(PREFIX, ""))
    : 0;
  const start = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = `${PREFIX}${String(start + attempt).padStart(6, "0")}`;
    const exists = await DB.Models.TransactionRegistration.exists({
      transactionReference: candidate,
    });
    if (!exists) return candidate;
  }

  return `${PREFIX}${Date.now().toString().slice(-6)}`;
}

export function certificateVerifyPath(reference: string): string {
  return `/verify/${normalizeTransactionReference(reference)}`;
}
