import { Response, NextFunction } from "express";
import { DB } from "..";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { ensureFirebaseAdmin } from "../../services/firebaseAdmin.service";

/**
 * @swagger
 * /account/device-token:
 *   post:
 *     tags:
 *       - Account > Device
 *     summary: Upsert device token for push notifications
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - deviceId
 *             properties:
 *               token:
 *                 type: string
 *                 description: FCM token for push notifications
 *               deviceId:
 *                 type: string
 *                 description: Unique device identifier
 *               platform:
 *                 type: string
 *                 description: Device platform (ios/android)
 *     responses:
 *       200:
 *         description: Device token saved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     deviceId:
 *                       type: string
 *                     platform:
 *                       type: string
 *       401:
 *         description: User not authenticated
 *       404:
 *         description: User not found
 */
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

/**
 * @swagger
 * /account/device-token:
 *   delete:
 *     tags:
 *       - Account > Device
 *     summary: Remove device token
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceId
 *             properties:
 *               deviceId:
 *                 type: string
 *                 description: Device identifier to remove
 *     responses:
 *       200:
 *         description: Device token removed
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
 *         description: Device ID is required
 *       401:
 *         description: User not authenticated
 *       404:
 *         description: User not found
 */
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
