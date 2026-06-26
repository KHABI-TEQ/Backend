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
