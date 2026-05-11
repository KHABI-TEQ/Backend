import { Response, NextFunction } from "express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import adminNotificationService from "../../services/adminNotification.service";
import type { AdminNotificationType } from "../../models/adminNotification";
import { AppRequest } from "../../types/express";

const ALLOWED_TYPES: AdminNotificationType[] = [
  "kyc_submitted",
  "document_verification_submitted",
  "transaction_registration_submitted",
  "transaction_registration_fee_paid",
  "agent_report_submitted",
  "syndication_application_submitted",
  "dealsite_reported",
  "general",
];

/**
 * GET /api/admin/notifications
 */
export const getAdminNotifications = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const adminId = req.admin?._id?.toString();
    if (!adminId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized");
    }

    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    let isRead: boolean | undefined;
    if (req.query.isRead === "true") isRead = true;
    if (req.query.isRead === "false") isRead = false;

    let type: AdminNotificationType | undefined;
    const t = req.query.type ? String(req.query.type) : "";
    if (t && ALLOWED_TYPES.includes(t as AdminNotificationType)) {
      type = t as AdminNotificationType;
    }

    const { data, pagination } = await adminNotificationService.listForAdmin(
      adminId,
      {
        page: Number.isFinite(page) ? page : 1,
        limit: Number.isFinite(limit) ? limit : 20,
        isRead,
        type,
      }
    );

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Admin notifications",
      data,
      pagination,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/notifications/unread-count
 */
export const getAdminUnreadNotificationCount = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const adminId = req.admin?._id?.toString();
    if (!adminId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized");
    }

    const unreadCount = await adminNotificationService.unreadCount(adminId);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Unread count",
      data: { unreadCount },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/admin/notifications/:notificationId/read
 */
export const markAdminNotificationRead = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const adminId = req.admin?._id?.toString();
    if (!adminId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized");
    }

    const { notificationId } = req.params;
    const ok = await adminNotificationService.markRead(adminId, notificationId);
    if (!ok) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Notification not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Marked as read",
      data: { notificationId },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/admin/notifications/read-all
 */
export const markAllAdminNotificationsRead = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const adminId = req.admin?._id?.toString();
    if (!adminId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized");
    }

    const modified = await adminNotificationService.markAllRead(adminId);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "All notifications marked as read",
      data: { modifiedCount: modified },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/admin/notifications/:notificationId
 */
export const deleteAdminNotification = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const adminId = req.admin?._id?.toString();
    if (!adminId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized");
    }

    const { notificationId } = req.params;
    const ok = await adminNotificationService.deleteOne(adminId, notificationId);
    if (!ok) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Notification not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Notification deleted",
      data: { notificationId },
    });
  } catch (err) {
    next(err);
  }
};
