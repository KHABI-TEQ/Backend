import { Response, NextFunction } from "express";
import { DB } from "..";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { ensureFirebaseAdmin } from "../../services/firebaseAdmin.service";

export const upsertAccountDeviceToken = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated.");
    }

    const { token, deviceId, platform } = req.body;
    const normalizedDeviceId = String(deviceId).trim();
    const fcmToken = String(token).trim();

    ensureFirebaseAdmin();

    const user = await DB.Models.User.findById(userId);
    if (!user) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "User not found.");
    }

    const devices = Array.isArray((user as any).devices) ? [...(user as any).devices] : [];
    const idx = devices.findIndex((d: any) => d.deviceId === normalizedDeviceId);
    const entry = {
      deviceId: normalizedDeviceId,
      fcmToken,
      platform: platform || undefined,
      updatedAt: new Date(),
    };

    if (idx >= 0) {
      devices[idx] = entry as any;
    } else {
      devices.push(entry as any);
    }

    (user as any).devices = devices;
    await user.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Device token saved.",
      data: {
        deviceId: normalizedDeviceId,
        platform: platform || null,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const removeAccountDeviceToken = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated.");
    }

    const deviceId =
      req.body?.deviceId || (req.query?.deviceId as string | undefined);
    if (!deviceId) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Device ID is required.");
    }

    const normalizedDeviceId = String(deviceId).trim();
    const user = await DB.Models.User.findById(userId);
    if (!user) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "User not found.");
    }

    (user as any).devices = ((user as any).devices || []).filter(
      (d: any) => d.deviceId !== normalizedDeviceId
    );
    await user.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Device token removed.",
    });
  } catch (err) {
    next(err);
  }
};
