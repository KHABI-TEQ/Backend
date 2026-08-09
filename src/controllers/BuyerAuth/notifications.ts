import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import {
  getBuyerUnreadCount,
  listBuyerNotifications,
  markAllBuyerNotificationsRead,
  markBuyerNotificationRead,
} from "../../services/buyerNotification.service";

export const listMyNotifications = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.buyer?._id) {
      throw new RouteError(
        HttpStatusCodes.UNAUTHORIZED,
        "Buyer not authenticated."
      );
    }

    const result = await listBuyerNotifications(String(req.buyer._id), {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      unreadOnly: String(req.query.unreadOnly || "") === "true",
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: result.data,
      unreadCount: result.unreadCount,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
};

export const getMyUnreadNotificationCount = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.buyer?._id) {
      throw new RouteError(
        HttpStatusCodes.UNAUTHORIZED,
        "Buyer not authenticated."
      );
    }

    const unreadCount = await getBuyerUnreadCount(String(req.buyer._id));
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: { unreadCount },
    });
  } catch (err) {
    next(err);
  }
};

export const markMyNotificationRead = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.buyer?._id) {
      throw new RouteError(
        HttpStatusCodes.UNAUTHORIZED,
        "Buyer not authenticated."
      );
    }

    const { notificationId } = req.params;
    if (!mongoose.isValidObjectId(notificationId)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Invalid notification ID."
      );
    }

    const doc = await markBuyerNotificationRead(
      String(req.buyer._id),
      notificationId
    );
    if (!doc) {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        "Notification not found."
      );
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Notification marked as read.",
      data: doc,
    });
  } catch (err) {
    next(err);
  }
};

export const markAllMyNotificationsRead = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.buyer?._id) {
      throw new RouteError(
        HttpStatusCodes.UNAUTHORIZED,
        "Buyer not authenticated."
      );
    }

    const modifiedCount = await markAllBuyerNotificationsRead(
      String(req.buyer._id)
    );

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "All notifications marked as read.",
      data: { modifiedCount },
    });
  } catch (err) {
    next(err);
  }
};
