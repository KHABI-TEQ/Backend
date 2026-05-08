import { NextFunction, Response } from "express";
import { Types } from "mongoose";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { AppRequest } from "../../types/express";
import { DB } from "../index";

export const listApprovedSyndicationPlatforms = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const platforms = await DB.Models.SyndicationPlatform.find({
      status: "approved",
      "config.outboundEnabled": { $ne: false },
    })
      .select("platformKey platformName description authType config status createdAt updatedAt")
      .sort({ platformName: 1 })
      .lean();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Approved syndication platforms fetched successfully",
      data: platforms,
    });
  } catch (err) {
    next(err);
  }
};

export const createSyndicationConnection = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?._id;
    if (!userId) throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");

    const { platformId, credentials } = req.body || {};
    if (!platformId || !Types.ObjectId.isValid(platformId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Valid platformId is required");
    }

    const platform = await DB.Models.SyndicationPlatform.findOne({
      _id: platformId,
      status: "approved",
      "config.outboundEnabled": { $ne: false },
    }).lean();
    if (!platform) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Platform is not approved for connections");
    }

    const existing = await DB.Models.PlatformConnection.findOne({
      userId: new Types.ObjectId(userId),
      platformId: new Types.ObjectId(platformId),
    }).lean();
    if (existing) {
      throw new RouteError(HttpStatusCodes.CONFLICT, "Connection already exists for this platform");
    }

    const created = await DB.Models.PlatformConnection.create({
      userId: new Types.ObjectId(userId),
      platformId: new Types.ObjectId(platformId),
      platformKey: platform.platformKey,
      platformName: platform.platformName,
      authType: platform.authType,
      status: "active",
      credentials: {
        accessToken: credentials?.accessToken,
        refreshToken: credentials?.refreshToken,
        apiKey: credentials?.apiKey,
        tokenExpiresAt: credentials?.tokenExpiresAt,
      },
      config: {
        baseUrl: platform.config.baseUrl,
        outboundEnabled: true,
        inboundWebhookEnabled: platform.config.inboundWebhookEnabled !== false,
      },
    });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Platform connection created successfully",
      data: created,
    });
  } catch (err) {
    next(err);
  }
};

export const toggleSyndicationConnection = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?._id;
    if (!userId) throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");

    const { id } = req.params;
    const { enabled } = req.body || {};
    if (!Types.ObjectId.isValid(id)) throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid connection id");
    if (typeof enabled !== "boolean") throw new RouteError(HttpStatusCodes.BAD_REQUEST, "enabled boolean is required");

    const status = enabled ? "active" : "inactive";
    const updated = await DB.Models.PlatformConnection.findOneAndUpdate(
      { _id: id, userId: new Types.ObjectId(userId) },
      { $set: { status, "config.outboundEnabled": enabled } },
      { new: true }
    );
    if (!updated) throw new RouteError(HttpStatusCodes.NOT_FOUND, "Connection not found");

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: `Platform connection ${enabled ? "enabled" : "disabled"} successfully`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

export const listMySyndicationConnections = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?._id;
    if (!userId) throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");

    const data = await DB.Models.PlatformConnection.find({ userId: new Types.ObjectId(userId) })
      .populate("platformId")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Syndication connections fetched successfully",
      data,
    });
  } catch (err) {
    next(err);
  }
};

