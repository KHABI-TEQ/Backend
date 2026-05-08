import { NextFunction, Response } from "express";
import crypto from "crypto";
import HttpStatusCodes from "../../../../common/HttpStatusCodes";
import { AppRequest } from "../../../../types/express";
import { DB } from "../../..";
import { saveInboundSyndicationWebhook } from "../../../../services/propertySyndication.service";
import { dealSiteOriginFromPublicSlug } from "../../../../config/dealSitePublicHost";

function safeHeaders(req: AppRequest): Record<string, unknown> {
  return {
    "user-agent": req.headers["user-agent"],
    "x-platform-signature": req.headers["x-platform-signature"],
    "x-event-id": req.headers["x-event-id"],
  };
}

function verifySignature(payload: Record<string, unknown>, signatureHeader?: string): boolean {
  const secret = process.env.SYNDICATION_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!signatureHeader) return false;
  const body = JSON.stringify(payload || {});
  const computed = crypto.createHmac("sha256", secret).update(body).digest("hex");
  if (computed.length !== signatureHeader.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signatureHeader));
}

export async function receiveSyndicationWebhook(
  req: AppRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const platformKey = String(req.params.platformKey || "").trim().toLowerCase();
    if (!platformKey) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({ success: false, message: "platformKey is required" });
    }

    const signature = String(req.headers["x-platform-signature"] || "");
    const payload = (req.body || {}) as Record<string, unknown>;
    if (!verifySignature(payload, signature || undefined)) {
      return res.status(HttpStatusCodes.UNAUTHORIZED).json({ success: false, message: "Invalid signature" });
    }

    const result = await saveInboundSyndicationWebhook({
      platformKey,
      headers: safeHeaders(req),
      payload,
    });

    return res.status(HttpStatusCodes.ACCEPTED).json({
      success: true,
      duplicated: result.duplicated,
      status: result.status || "processed",
    });
  } catch (error) {
    next(error);
  }
}

export async function redirectSyndicationInspection(
  req: AppRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const propertyId = String(req.params.propertyId || "");
    const ownerId = String(req.query.ownerId || "");
    const sig = String(req.query.sig || "");

    const secret = process.env.SYNDICATION_LINK_SECRET || "khabiteq-syndication";
    const expectedSig = crypto.createHmac("sha256", secret).update(`${propertyId}:${ownerId}`).digest("hex").slice(0, 24);
    if (!propertyId || !ownerId || sig !== expectedSig) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Invalid inspection link",
      });
    }

    const dealSite = await DB.Models.DealSite.findOne({ createdBy: ownerId, status: "running" }).sort({ updatedAt: -1 }).lean();
    if (!dealSite?.publicSlug) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Dealsite not found for inspection flow",
      });
    }

    const destination = `${dealSiteOriginFromPublicSlug(dealSite.publicSlug)}/inspection?propertyId=${propertyId}&src=khabiteq`;
    return res.redirect(destination);
  } catch (error) {
    next(error);
  }
}
