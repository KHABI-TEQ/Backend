import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { getWhatsAppServiceIfConfigured } from "../../services/whatsappClient.service";

/**
 * POST /api/admin/whatsapp/test
 * Body: { phone: string } — sends `test_message` template.
 */
export const postWhatsappTest = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const phone = String(req.body?.phone || "").trim();
    if (!phone) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "phone is required");
    }
    const wa = getWhatsAppServiceIfConfigured();
    if (!wa) {
      throw new RouteError(
        HttpStatusCodes.SERVICE_UNAVAILABLE,
        "WhatsApp is not configured (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID)"
      );
    }
    const result = await wa.testConnection(phone);
    return res.status(HttpStatusCodes.OK).json({
      success: result.success,
      data: result,
    });
  } catch (e) {
    next(e);
  }
};

/**
 * POST /api/admin/whatsapp/broadcast
 * Body: { users: { id, name, phone }[], templateKey, variables?, delayBetweenMessages? }
 */
export const postWhatsappBroadcast = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { users, templateKey, variables, delayBetweenMessages } = req.body || {};
    if (!Array.isArray(users) || !users.length) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "users[] is required");
    }
    if (!templateKey || typeof templateKey !== "string") {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "templateKey is required");
    }
    const wa = getWhatsAppServiceIfConfigured();
    if (!wa) {
      throw new RouteError(
        HttpStatusCodes.SERVICE_UNAVAILABLE,
        "WhatsApp is not configured (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID)"
      );
    }
    const result = await wa.sendBroadcast({
      users: users.map((u: { id?: string; name?: string; phone: string; customVariables?: Record<string, unknown> }) => ({
        id: String(u.id || ""),
        name: String(u.name || "there"),
        phone: u.phone,
        customVariables: u.customVariables,
      })),
      templateKey,
      variables: variables && typeof variables === "object" ? variables : {},
      delayBetweenMessages:
        typeof delayBetweenMessages === "number" ? delayBetweenMessages : 1000,
    });
    return res.status(HttpStatusCodes.OK).json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
};

/**
 * POST /api/admin/whatsapp/send-template
 * Body: { phone, templateKey, variables?: Record<string, string> }
 * Sends an arbitrary approved template (covers marketing / system keys with no app event).
 */
export const postWhatsappSendTemplate = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const phone = String(req.body?.phone || "").trim();
    const templateKey = String(req.body?.templateKey || "").trim();
    const variables = req.body?.variables;
    if (!phone || !templateKey) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "phone and templateKey are required");
    }
    const wa = getWhatsAppServiceIfConfigured();
    if (!wa) {
      throw new RouteError(
        HttpStatusCodes.SERVICE_UNAVAILABLE,
        "WhatsApp is not configured (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID)"
      );
    }
    const result = await wa.sendMessage(phone, templateKey, variables && typeof variables === "object" ? variables : {});
    return res.status(HttpStatusCodes.OK).json({ success: result.success, data: result });
  } catch (e) {
    next(e);
  }
};

/**
 * POST /api/admin/whatsapp/media
 * Body: { phone, mediaType: 'image'|'document'|'video'|'audio', mediaUrl, caption? }
 */
export const postWhatsappMedia = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const phone = String(req.body?.phone || "").trim();
    const mediaType = req.body?.mediaType;
    const mediaUrl = String(req.body?.mediaUrl || "").trim();
    const caption = String(req.body?.caption || "");
    if (!phone || !mediaUrl) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "phone and mediaUrl are required");
    }
    if (!["image", "document", "video", "audio"].includes(mediaType)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "mediaType must be image, document, video, or audio"
      );
    }
    const wa = getWhatsAppServiceIfConfigured();
    if (!wa) {
      throw new RouteError(
        HttpStatusCodes.SERVICE_UNAVAILABLE,
        "WhatsApp is not configured (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID)"
      );
    }
    const result = await wa.sendMediaMessage(phone, mediaType, mediaUrl, caption);
    return res.status(HttpStatusCodes.OK).json({ success: result.success, data: result });
  } catch (e) {
    next(e);
  }
};

/**
 * GET /api/admin/whatsapp/analytics
 */
export const getWhatsappAnalytics = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const wa = getWhatsAppServiceIfConfigured();
    if (!wa) {
      throw new RouteError(
        HttpStatusCodes.SERVICE_UNAVAILABLE,
        "WhatsApp is not configured (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID)"
      );
    }
    return res.status(HttpStatusCodes.OK).json({ success: true, data: wa.getAnalytics() });
  } catch (e) {
    next(e);
  }
};
