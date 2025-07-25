import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import mongoose from "mongoose";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import notificationService from "../../services/notification.service";

/**
 * Get All Notifications for User
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
 * Get Notification by ID
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
 * 
 * @param req 
 * @param res 
 * @param next 
 * @returns 
 * 
 * Mark notificaton as un Read
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
 * Mark All Notifications as Read for User
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
 * Delete Single Notification by ID
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
 * Delete All Notifications for User
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
 * Bulk Delete Notifications by IDs
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
