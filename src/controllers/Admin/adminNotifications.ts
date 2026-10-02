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
/**
 * @swagger
 * /admin/notifications:
 *   get:
 *     tags:
 *       - Admin > Notifications
 *     summary: Get all admin notifications
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
 *       - name: isRead
 *         in: query
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Notifications fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               {'$ref': '#/components/schemas/Pagination'}
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
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
/**
 * @swagger
 * /admin/notifications/unread-count:
 *   get:
 *     tags:
 *       - Admin > Notifications
 *     summary: Get unread notification count
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count fetched successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
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
/**
 * @swagger
 * /admin/notifications/{notificationId}/read:
 *   put:
 *     tags:
 *       - Admin > Notifications
 *     summary: Mark admin notification as read
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: notificationId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Notification not found
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
/**
 * @swagger
 * /admin/notifications/read-all:
 *   put:
 *     tags:
 *       - Admin > Notifications
 *     summary: Mark all admin notifications as read
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *       401:
 *         description: Not authenticated
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
/**
 * @swagger
 * /admin/notifications/{notificationId}:
 *   delete:
 *     tags:
 *       - Admin > Notifications
 *     summary: Delete admin notification
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: notificationId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification deleted successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Notification not found
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
