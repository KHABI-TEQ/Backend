import { NextFunction, Response } from "express";
import { Types } from "mongoose";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { AppRequest } from "../../types/express";
import { DB } from "../index";

function sanitizeSyndicationConnectionForClient(doc: any): any {
  const plain = doc && typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  if (plain.credentials) {
    const c = { ...plain.credentials };
    delete c.password;
    delete c.apiKey;
    delete c.refreshToken;
    delete c.accessToken;
    plain.credentials = c;
  }
  return plain;
}

function validateConnectionCredentialsForAuthType(
  authType: string,
  credentials: Record<string, unknown> | undefined
): void {
  const cred = credentials || {};
  if (authType === "partner_login") {
    const email = String(cred.email || "").trim();
    const password = cred.password != null ? String(cred.password) : "";
    if (!email || !password) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "credentials.email and credentials.password (partner platform login) are required for this integration"
      );
    }
    return;
  }
  if (authType === "api_key") {
    if (!String(cred.apiKey || "").trim()) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "credentials.apiKey is required for this integration");
    }
    return;
  }
  if (authType === "oauth2") {
    if (!String(cred.accessToken || "").trim()) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "credentials.accessToken is required for this integration");
    }
    return;
  }
  if (authType === "basic") {
    if (!String(cred.apiKey || "").trim()) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "credentials.apiKey is required (Base64-encoded user:password) for basic auth integrations"
      );
    }
  }
}

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

    validateConnectionCredentialsForAuthType(platform.authType, credentials);

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
        email: credentials?.email != null ? String(credentials.email).trim().toLowerCase() : undefined,
        password: credentials?.password != null ? String(credentials.password) : undefined,
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
      data: sanitizeSyndicationConnectionForClient(created),
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
      data: sanitizeSyndicationConnectionForClient(updated),
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
      data: data.map((row) => sanitizeSyndicationConnectionForClient(row)),
    });
  } catch (err) {
    next(err);
  }
};

