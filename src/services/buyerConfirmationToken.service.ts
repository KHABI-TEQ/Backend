import jwt from "jsonwebtoken";

export const CONFIRM_TOKEN_PURPOSE_INSPECTION = "inspection_confirm" as const;
export const CONFIRM_TOKEN_PURPOSE_TRANSACTION = "transaction_confirm" as const;

export type BuyerConfirmationTokenPurpose =
  | typeof CONFIRM_TOKEN_PURPOSE_INSPECTION
  | typeof CONFIRM_TOKEN_PURPOSE_TRANSACTION;

const JWT_EXPIRY = "60d";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.JWT_SECRET_ADMIN;
  if (!secret) throw new Error("JWT_SECRET or JWT_SECRET_ADMIN required for buyer confirmation tokens");
  return secret;
}

export function getBuyerConfirmationApiPath(): string {
  const base = (process.env.API_BASE_URL || process.env.BACKEND_URL || "").replace(/\/$/, "");
  const apiPrefix = process.env.API_PREFIX || "/api";
  return base ? `${base}${apiPrefix}` : "";
}

export function generateBuyerConfirmationToken(
  inspectionId: string,
  purpose: BuyerConfirmationTokenPurpose
): string {
  return jwt.sign({ inspectionId, purpose }, getJwtSecret(), { expiresIn: JWT_EXPIRY });
}

/**
 * Verifies JWT. If `purpose` is omitted (legacy transaction emails), treat as `transaction_confirm`.
 */
export function verifyBuyerConfirmationToken(
  token: string
): { inspectionId: string; purpose: BuyerConfirmationTokenPurpose } | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as {
      inspectionId?: string;
      purpose?: string;
    };
    if (!decoded?.inspectionId) return null;
    const p = decoded.purpose;
    if (p === CONFIRM_TOKEN_PURPOSE_INSPECTION) {
      return { inspectionId: decoded.inspectionId, purpose: CONFIRM_TOKEN_PURPOSE_INSPECTION };
    }
    return { inspectionId: decoded.inspectionId, purpose: CONFIRM_TOKEN_PURPOSE_TRANSACTION };
  } catch {
    return null;
  }
}
