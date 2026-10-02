import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import {
  countAwaitingHumanSessions,
  getWhatsappSupportSession,
  listAwaitingHumanSessions,
  replyToWhatsappSupportSession,
  resolveWhatsappSupportSession,
} from "../../services/whatsapp/whatsappSupport.service";

/**
 * GET /api/admin/whatsapp/support/sessions
 */
/**
 * @swagger
 * /admin/whatsapp/support/sessions:
 *   get:
 *     tags:
 *       - Admin > WhatsApp
 *     summary: Get WhatsApp support sessions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Support sessions fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               {'$ref': '#/components/schemas/Pagination'}
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 */
export const listWhatsappSupportSessions = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const step = (req.query.step as string) || "awaiting_human";

    const data = await listAwaitingHumanSessions({ page, limit, step: step as any });
    return res.status(HttpStatusCodes.OK).json({ success: true, data });
  } catch (e) {
    next(e);
  }
};

/**
 * GET /api/admin/whatsapp/support/sessions/count
 */
/**
 * @swagger
 * /admin/whatsapp/support/sessions/count:
 *   get:
 *     tags:
 *       - Admin > WhatsApp
 *     summary: Get WhatsApp support session count
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Support session count fetched successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 */
export const getWhatsappSupportCount = async (
  _req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const count = await countAwaitingHumanSessions();
    return res.status(HttpStatusCodes.OK).json({ success: true, data: { count } });
  } catch (e) {
    next(e);
  }
};

/**
 * GET /api/admin/whatsapp/support/sessions/:phone
 */
/**
 * @swagger
 * /admin/whatsapp/support/sessions/{phone}:
 *   get:
 *     tags:
 *       - Admin > WhatsApp
 *     summary: Get WhatsApp support session by phone
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: phone
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Support session fetched successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Session not found
 */
export const getWhatsappSupportSessionDetail = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const phone = String(req.params.phone || "").trim();
    if (!phone) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "phone is required");
    }
    const session = await getWhatsappSupportSession(phone);
    if (!session) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Session not found");
    }
    return res.status(HttpStatusCodes.OK).json({ success: true, data: session });
  } catch (e) {
    next(e);
  }
};

/**
 * POST /api/admin/whatsapp/support/sessions/:phone/reply
 * Body: { message: string }
 */
/**
 * @swagger
 * /admin/whatsapp/support/sessions/{phone}/reply:
 *   post:
 *     tags:
 *       - Admin > WhatsApp
 *     summary: Reply to WhatsApp support session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: phone
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: Reply message content
 *     responses:
 *       200:
 *         description: Reply sent successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Session not found
 */
export const postWhatsappSupportReply = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const phone = String(req.params.phone || "").trim();
    const message = String(req.body?.message || "").trim();
    if (!phone || !message) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "phone and message are required");
    }

    const admin = req.admin as { _id?: { toString(): string }; firstName?: string; lastName?: string };
    const result = await replyToWhatsappSupportSession(phone, message, {
      id: admin?._id?.toString() || "admin",
      name: [admin?.firstName, admin?.lastName].filter(Boolean).join(" ") || "Support",
    });

    if (!result.success) {
      throw new RouteError(HttpStatusCodes.BAD_GATEWAY, result.error || "Reply failed");
    }

    return res.status(HttpStatusCodes.OK).json({ success: true, message: "Reply sent" });
  } catch (e) {
    next(e);
  }
};

/**
 * PATCH /api/admin/whatsapp/support/sessions/:phone/resolve
 */
/**
 * @swagger
 * /admin/whatsapp/support/sessions/{phone}/resolve:
 *   put:
 *     tags:
 *       - Admin > WhatsApp
 *     summary: Resolve WhatsApp support session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: phone
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resolution
 *             properties:
 *               resolution:
 *                 type: string
 *                 enum: ['resolved', 'closed', 'escalated']
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Support session resolved successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Session not found
 */
export const patchWhatsappSupportResolve = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const phone = String(req.params.phone || "").trim();
    if (!phone) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "phone is required");
    }
    await resolveWhatsappSupportSession(phone);
    return res.status(HttpStatusCodes.OK).json({ success: true, message: "Session resolved" });
  } catch (e) {
    next(e);
  }
};
