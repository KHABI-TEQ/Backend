import { Response, NextFunction } from "express";
import { DB } from "..";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { ensureFirebaseAdmin } from "../../services/firebaseAdmin.service";

export const upsertBuyerDeviceToken = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const buyerId = req.buyer?._id;
    if (!buyerId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Buyer not authenticated.");
    }

    const { token, deviceId, platform } = req.body;
    const normalizedDeviceId = String(deviceId).trim();
    const fcmToken = String(token).trim();

    // Ensure Firebase Admin is initialized when credentials exist (no-op otherwise).
    ensureFirebaseAdmin();

    const buyer = await DB.Models.Buyer.findById(buyerId);
    if (!buyer) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Buyer not found.");
    }

    const devices = Array.isArray(buyer.devices) ? [...buyer.devices] : [];
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

    buyer.devices = devices as any;
    await buyer.save();

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

export const removeBuyerDeviceToken = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const buyerId = req.buyer?._id;
    if (!buyerId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Buyer not authenticated.");
    }

    const deviceId =
      req.body?.deviceId || (req.query?.deviceId as string | undefined);
    if (!deviceId) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Device ID is required.");
    }

    const normalizedDeviceId = String(deviceId).trim();
    const buyer = await DB.Models.Buyer.findById(buyerId);
    if (!buyer) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Buyer not found.");
    }

    buyer.devices = (buyer.devices || []).filter(
      (d: any) => d.deviceId !== normalizedDeviceId
    ) as any;
    await buyer.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Device token removed.",
    });
  } catch (err) {
    next(err);
  }
};
