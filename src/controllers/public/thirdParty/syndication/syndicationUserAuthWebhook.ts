import { NextFunction, Response } from "express";
import crypto from "crypto";
import HttpStatusCodes from "../../../../common/HttpStatusCodes";
import { AppRequest } from "../../../../types/express";
import { DB } from "../../..";
import { finalizeSyndicationConnectionFromPartnerAuthCallback } from "../../../../services/syndicationPartnerCredentialVerification.service";

function verifyAuthCallbackSignature(payload: Record<string, unknown>, signatureHeader?: string): boolean {
  const secret =
    String(process.env.SYNDICATION_AUTH_CALLBACK_SECRET || process.env.SYNDICATION_WEBHOOK_SECRET || "").trim();
  if (!secret) return true;
  if (!signatureHeader) return false;
  const body = JSON.stringify(payload || {});
  const computed = crypto.createHmac("sha256", secret).update(body).digest("hex");
  if (computed.length !== signatureHeader.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signatureHeader));
}

export async function receiveSyndicationUserAuthWebhook(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const signature = String(req.headers["x-platform-signature"] || "");
    const payload = (req.body || {}) as Record<string, unknown>;
    if (!verifyAuthCallbackSignature(payload, signature || undefined)) {
      return res.status(HttpStatusCodes.UNAUTHORIZED).json({ success: false, message: "Invalid signature" });
    }

    const platformKey = String(payload.platformKey || "").trim().toLowerCase();
    if (platformKey) {
      const platform = await DB.Models.SyndicationPlatform.findOne({ platformKey, status: "approved" }).lean();
      if (!platform) {
        return res.status(HttpStatusCodes.BAD_REQUEST).json({ success: false, message: "Unknown or unapproved platform" });
      }
    }

    const correlationId = String(payload.correlationId || "").trim();
    const email = String(payload.email || "").trim().toLowerCase();
    const success = Boolean(payload.success);
    const verified = Boolean(payload.verified);
    const message = payload.message != null ? String(payload.message) : undefined;
    const externalUserId = payload.externalUserId != null ? String(payload.externalUserId) : undefined;

    if (!correlationId || !email || !platformKey) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "correlationId, email and platformKey are required",
      });
    }

    const result = await finalizeSyndicationConnectionFromPartnerAuthCallback({
      correlationId,
      platformKey,
      email,
      success,
      verified,
      message,
      externalUserId,
    });

    if (!result.ok) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({ success: false, message: result.error || "Rejected" });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      duplicate: Boolean(result.duplicate),
    });
  } catch (error) {
    next(error);
  }
}
