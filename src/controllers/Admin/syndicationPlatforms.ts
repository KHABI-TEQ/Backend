import { NextFunction, Response } from "express";
import { Types } from "mongoose";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { AppRequest } from "../../types/express";
import { DB } from "../index";

export const createSyndicationPlatform = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { platformKey, platformName, description, authType, config } = req.body || {};
    if (!platformKey || !platformName || !authType || !config?.baseUrl) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "platformKey, platformName, authType and config.baseUrl are required");
    }

    const key = String(platformKey).trim().toLowerCase();
    const exists = await DB.Models.SyndicationPlatform.findOne({ platformKey: key }).lean();
    if (exists) {
      throw new RouteError(HttpStatusCodes.CONFLICT, "Platform key already exists");
    }

    const created = await DB.Models.SyndicationPlatform.create({
      platformKey: key,
      platformName: String(platformName).trim(),
      description: description ? String(description) : undefined,
      authType,
      status: "approved",
      config: {
        baseUrl: String(config.baseUrl).trim(),
        outboundEnabled: config.outboundEnabled !== false,
        inboundWebhookEnabled: config.inboundWebhookEnabled !== false,
      },
    });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Syndication platform created successfully",
      data: created,
    });
  } catch (err) {
    next(err);
  }
};

export const editSyndicationPlatform = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid platform id");

    const payload: any = {};
    if (req.body.platformName !== undefined) payload.platformName = String(req.body.platformName).trim();
    if (req.body.description !== undefined) payload.description = req.body.description ? String(req.body.description) : undefined;
    if (req.body.authType !== undefined) payload.authType = req.body.authType;

    if (req.body.config) {
      if (req.body.config.baseUrl !== undefined) payload["config.baseUrl"] = String(req.body.config.baseUrl).trim();
      if (req.body.config.outboundEnabled !== undefined) payload["config.outboundEnabled"] = Boolean(req.body.config.outboundEnabled);
      if (req.body.config.inboundWebhookEnabled !== undefined) payload["config.inboundWebhookEnabled"] = Boolean(req.body.config.inboundWebhookEnabled);
    }

    const updated = await DB.Models.SyndicationPlatform.findByIdAndUpdate(id, { $set: payload }, { new: true });
    if (!updated) throw new RouteError(HttpStatusCodes.NOT_FOUND, "Syndication platform not found");

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Syndication platform updated successfully",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

export const updateSyndicationPlatformStatus = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!Types.ObjectId.isValid(id)) throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid platform id");
    if (!["approved", "disabled"].includes(String(status))) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "status must be approved or disabled");
    }

    const updated = await DB.Models.SyndicationPlatform.findByIdAndUpdate(
      id,
      { $set: { status: String(status) } },
      { new: true }
    );
    if (!updated) throw new RouteError(HttpStatusCodes.NOT_FOUND, "Syndication platform not found");

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: `Syndication platform ${status} successfully`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

export const listSyndicationPlatformsForAdmin = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    const query: any = {};
    if (status && ["approved", "disabled"].includes(String(status))) query.status = String(status);

    const items = await DB.Models.SyndicationPlatform.find(query).sort({ createdAt: -1 }).lean();
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Syndication platforms fetched successfully",
      data: items,
    });
  } catch (err) {
    next(err);
  }
};

