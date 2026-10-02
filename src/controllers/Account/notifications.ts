import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import mongoose from "mongoose";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import notificationService from "../../services/notification.service";

/**
 * @swagger
 * /account/notifications:
 *   get:
 *     tags:
 *       - Account > Notifications
 *     summary: Get all notifications for authenticated user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Notifications fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     page:
 *                       type: number
 *                     limit:
 *                       type: number
 *                     totalPages:
 *                       type: number
 */
export const getAllNotifications = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { data, pagination } = await notificationService.getAll(req.user._id, req.query);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data,
      pagination: pagination ?? null,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /account/notifications/{notificationId}:
 *   get:
 *     tags:
 *       - Account > Notifications
 *     summary: Get notification by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid notification ID
 *       404:
 *         description: Notification not found
 */
export const getNotificationById = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { notificationId } = req.params;
    if (!mongoose.isValidObjectId(notificationId)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Invalid notification ID",
      );
    }

    const notification = await notificationService.getById(notificationId);
    if (!notification) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Notification not found");
    }

    return res
      .status(HttpStatusCodes.OK)
      .json({ success: true, data: notification });
  } catch (err) {
    next(err);
  }
};

/**
 * Mark Single Notification as Read
 */
export const markNotificationAsRead = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { notificationId } = req.params;
    if (!mongoose.isValidObjectId(notificationId)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Invalid notification ID",
      );
    }

    const marked = await notificationService.markRead(notificationId);
    if (!marked) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Notification not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Notification marked as read.",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /account/notifications/{notificationId}/markRead:
 *   put:
 *     tags:
 *       - Account > Notifications
 *     summary: Mark single notification as read
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid notification ID
 *       404:
 *         description: Notification not found
 */
export const markNotificationAsUnRead = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { notificationId } = req.params;
    if (!mongoose.isValidObjectId(notificationId)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Invalid notification ID",
      );
    }

    const marked = await notificationService.markUnRead(notificationId);
    if (!marked) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Notification not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Notification marked as unread.",
    });
  } catch (err) {
    next(err);
  }
};


/**
 * @swagger
 * /account/notifications/markAllRead:
 *   put:
 *     tags:
 *       - Account > Notifications
 *     summary: Mark all notifications as read
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
export const markAllNotificationsAsRead = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    await notificationService.markAllRead(req.user._id);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "All notifications marked as read.",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /account/notifications/{notificationId}/delete:
 *   delete:
 *     tags:
 *       - Account > Notifications
 *     summary: Delete single notification by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid notification ID
 *       404:
 *         description: Notification not found or already deleted
 */
export const deleteNotificationById = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { notificationId } = req.params;
    if (!mongoose.isValidObjectId(notificationId)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Invalid notification ID",
      );
    }

    const deleted = await notificationService.delete(notificationId);
    if (!deleted) {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        "Notification not found or already deleted",
      );
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Notification deleted successfully.",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /account/notifications/deleteAll:
 *   delete:
 *     tags:
 *       - Account > Notifications
 *     summary: Delete all notifications for authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
export const deleteAllNotifications = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    await notificationService.deleteAll(req.user._id);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "All notifications cleared successfully.",
    });
  } catch (err) {
    next(err);
  }
};


/**
 * @swagger
 * /account/notifications/bulkDelete:
 *   delete:
 *     tags:
 *       - Account > Notifications
 *     summary: Bulk delete notifications by IDs
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - notificationIds
 *             properties:
 *               notificationIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of notification IDs to delete
 *     responses:
 *       200:
 *         description: Notification(s) deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid notification ID(s)
 */
export const bulkDeleteNotifications = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { notificationIds } = req.body;

    if (
      !Array.isArray(notificationIds) ||
      notificationIds.length === 0 ||
      !notificationIds.every((id) => mongoose.isValidObjectId(id))
    ) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Invalid notification ID(s)"
      );
    }

    const result = await notificationService.bulkDelete(notificationIds, req.user._id);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: `${result.deletedCount} notification(s) deleted successfully.`,
    });
  } catch (err) {
    next(err);
  }
};
