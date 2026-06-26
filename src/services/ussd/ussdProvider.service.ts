import { Request } from "express";
import crypto from "crypto";

export type UssdAggregator = "africastalking" | "termii" | "generic";

export interface NormalizedUssdRequest {
  sessionId: string;
  phoneNumber: string;
  serviceCode: string;
  text: string;
  networkCode?: string;
}

export interface UssdResponse {
  /** CON = continue session, END = terminate */
  type: "CON" | "END";
  message: string;
}

export function getUssdAggregator(): UssdAggregator {
  const raw = (process.env.USSD_PROVIDER || "generic").trim().toLowerCase();
  if (raw === "africastalking" || raw === "termii") return raw;
  return "generic";
}

export function parseUssdRequest(req: Request): NormalizedUssdRequest {
  const body = req.body || {};
  const query = req.query || {};

  const sessionId = String(
    body.sessionId || body.session_id || query.sessionId || query.session_id || ""
  ).trim();
  const phoneNumber = String(
    body.phoneNumber || body.msisdn || body.phone || query.phoneNumber || query.msisdn || ""
  ).trim();
  const serviceCode = String(
    body.serviceCode || body.service_code || query.serviceCode || process.env.USSD_SERVICE_CODE || ""
  ).trim();
  const text = String(body.text ?? body.userData ?? query.text ?? "").trim();
  const networkCode = String(body.networkCode || body.network_code || "").trim() || undefined;

  return { sessionId, phoneNumber, serviceCode, text, networkCode };
}

export function formatUssdResponse(response: UssdResponse): string {
  const msg = response.message.replace(/\r\n/g, "\n").trim();
  return `${response.type} ${msg}`;
}

export function verifyUssdWebhook(req: Request): boolean {
  const secret = process.env.USSD_WEBHOOK_SECRET;
  if (!secret) return true;

  const signature =
    req.headers["x-ussd-signature"] ||
    req.headers["x-hub-signature"] ||
    req.headers["x-africastalking-signature"];

  if (!signature || typeof signature !== "string") {
    return false;
  }

  const rawBody =
    (req as Request & { rawBody?: string }).rawBody || JSON.stringify(req.body || {});
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signature.replace(/^sha256=/i, "");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

export function splitUssdInput(text: string): string[] {
  return String(text || "")
    .split("*")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}
