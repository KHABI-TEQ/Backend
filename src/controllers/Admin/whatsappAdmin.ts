import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { getWhatsAppServiceIfConfigured } from "../../services/whatsappClient.service";

type GraphishResult = { success: boolean; error?: string };

/**
 * When Meta/Graph returns an error, use a non-2xx status so clients and the Network tab
 * show failure. 401 for auth-style errors; 502 for other upstream failures.
 */
function httpStatusForUpstreamWhatsapp(result: GraphishResult): number {
  if (result.success) {
    return HttpStatusCodes.OK;
  }
  const e = (result.error || "").toLowerCase();
  if (
    e.includes("(401)") ||
    e.includes("authentication") ||
    e.includes("access token")
  ) {
    return HttpStatusCodes.UNAUTHORIZED;
  }
  return HttpStatusCodes.BAD_GATEWAY;
}

/**
 * POST /api/admin/whatsapp/test
 * Body: { phone: string } — sends Meta sample `hello_world` by default (see WHATSAPP_TEST_TEMPLATE_* env).
 * HTTP: 200 on success; 401 if Graph reports auth failure; 502 for other Graph errors.
 */
/**
 * @swagger
 * /admin/whatsapp/test:
 *   post:
 *     tags:
 *       - Admin > WhatsApp
 *     summary: Test WhatsApp connection
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 description: Test recipient phone number
 *     responses:
 *       200:
 *         description: Test message sent successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
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
    const status = httpStatusForUpstreamWhatsapp(result);
    return res.status(status).json({
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
/**
 * @swagger
 * /admin/whatsapp/broadcast:
 *   post:
 *     tags:
 *       - Admin > WhatsApp
 *     summary: Send WhatsApp broadcast
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *               - recipients
 *             properties:
 *               message:
 *                 type: string
 *                 description: Broadcast message content
 *               recipients:
 *                 type: array
 *                 items: {'type': 'string'}
 *                 description: Array of recipient phone numbers
 *     responses:
 *       200:
 *         description: Broadcast sent successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
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
    const allFailed = result.totalUsers > 0 && result.successCount === 0;
    const firstErr = allFailed
      ? result.results.find((r) => !r.success && r.error)?.error
      : undefined;
    const status = allFailed
      ? httpStatusForUpstreamWhatsapp({ success: false, error: firstErr })
      : HttpStatusCodes.OK;
    return res
      .status(status)
      .json({ success: !allFailed, data: result });
  } catch (e) {
    next(e);
  }
};

/**
 * POST /api/admin/whatsapp/send-template
 * Body: { phone, templateKey, variables?: Record<string, string> }
 * Sends an arbitrary approved template (covers marketing / system keys with no app event).
 */
/**
 * @swagger
 * /admin/whatsapp/send-template:
 *   post:
 *     tags:
 *       - Admin > WhatsApp
 *     summary: Send WhatsApp template
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - templateName
 *               - recipient
 *             properties:
 *               templateName:
 *                 type: string
 *                 description: Template name
 *               recipient:
 *                 type: string
 *                 description: Recipient phone number
 *               components:
 *                 type: array
 *                 description: Template components
 *     responses:
 *       200:
 *         description: Template sent successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
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
    const status = httpStatusForUpstreamWhatsapp(result);
    return res.status(status).json({ success: result.success, data: result });
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
    const status = httpStatusForUpstreamWhatsapp(result);
    return res.status(status).json({ success: result.success, data: result });
  } catch (e) {
    next(e);
  }
};

/**
 * GET /api/admin/whatsapp/analytics
 */
/**
 * @swagger
 * /admin/whatsapp/analytics:
 *   get:
 *     tags:
 *       - Admin > WhatsApp
 *     summary: Get WhatsApp analytics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: WhatsApp analytics fetched successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
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
