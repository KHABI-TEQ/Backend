import { NextFunction, Response } from "express";
import { randomUUID } from "crypto";
import { Types } from "mongoose";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { AppRequest } from "../../types/express";
import { DB } from "../index";
import {
  SYNDICATION_PROPERTY_TYPE_LABELS,
  SYNDICATION_PROPERTY_TYPE_VALUES,
} from "../../common/syndicationPropertyTypes";
import {
  publicApiBaseUrl,
  syndicationUserAuthenticationWebhookUrl,
} from "../../common/syndicationIntegrationUrls";
import {
  encryptSyndicationPendingSecret,
  postPartnerCredentialVerification,
  resolvePartnerSyndicationLoginUrl,
} from "../../services/syndicationPartnerCredentialVerification.service";

function sanitizeSyndicationConnectionForClient(doc: any): any {
  const plain = doc && typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  if (plain.credentials) {
    const c = { ...plain.credentials };
    delete c.password;
    delete c.apiKey;
    delete c.refreshToken;
    delete c.accessToken;
    delete c.externalUserId;
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
      .select("platformKey platformName description authType acceptedPropertyTypes config status createdAt updatedAt")
      .sort({ platformName: 1 })
      .lean();

    const propertyTypeCatalog = SYNDICATION_PROPERTY_TYPE_VALUES.map((value) => ({
      value,
      label: SYNDICATION_PROPERTY_TYPE_LABELS[value],
    }));

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Approved syndication platforms fetched successfully",
      data: platforms,
      propertyTypeCatalog,
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

    const userType = String((req.user as any)?.userType || "");

    if (platform.authType === "partner_login") {
      if (userType !== "Agent" && userType !== "Developer") {
        throw new RouteError(
          HttpStatusCodes.FORBIDDEN,
          "Only agents and developers can connect using partner platform login"
        );
      }

      const inProgress = await DB.Models.SyndicationConnectionVerification.findOne({
        userId: new Types.ObjectId(userId),
        platformId: new Types.ObjectId(platformId),
        status: "pending",
        expiresAt: { $gt: new Date() },
      }).lean();
      if (inProgress) {
        throw new RouteError(
          HttpStatusCodes.CONFLICT,
          "A connection verification is already in progress for this platform"
        );
      }

      const loginUrl = resolvePartnerSyndicationLoginUrl(platform);
      if (!loginUrl) {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          "Platform is missing syndication base URL (and optional login URL) for credential verification"
        );
      }

      const correlationId = randomUUID();
      const email = String(credentials?.email || "").trim().toLowerCase();
      const password = String(credentials?.password ?? "");
      const enc = encryptSyndicationPendingSecret(password);

      await DB.Models.SyndicationConnectionVerification.create({
        correlationId,
        userId: new Types.ObjectId(userId),
        platformId: new Types.ObjectId(platformId),
        platformKey: platform.platformKey,
        email,
        encBlob: enc.encBlob,
        encIv: enc.encIv,
        encTag: enc.encTag,
        status: "pending",
        expiresAt: new Date(Date.now() + 45 * 60 * 1000),
      });

      const probe = await postPartnerCredentialVerification({
        loginUrl,
        correlationId,
        platformKey: platform.platformKey,
        email,
        password,
      });

      if (!probe.ok) {
        await DB.Models.SyndicationConnectionVerification.deleteOne({ correlationId });
        throw new RouteError(
          HttpStatusCodes.BAD_GATEWAY,
          `Partner login endpoint error (HTTP ${probe.status || "n/a"}): ${JSON.stringify(probe.data || {}).slice(0, 500)}`
        );
      }

      const hubBase = publicApiBaseUrl();
      const authCallbackUrl = syndicationUserAuthenticationWebhookUrl();

      return res.status(HttpStatusCodes.ACCEPTED).json({
        success: true,
        message:
          "Verification started. Your partner platform will validate credentials and call Khabi-Teq’s authentication webhook. Poll the verification status until it completes, then your connection will appear under syndication connections.",
        data: {
          correlationId,
          verificationStatusPath: `/api/account/syndication/connections/verification/${correlationId}`,
          partnerLoginUrlUsed: loginUrl,
          authenticationCallbackUrl: authCallbackUrl || null,
          hubApiBaseUrl: hubBase || null,
        },
      });
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

export const getSyndicationVerificationStatus = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?._id;
    if (!userId) throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");

    const { correlationId } = req.params;
    if (!correlationId || typeof correlationId !== "string") {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "correlationId is required");
    }

    const row = await DB.Models.SyndicationConnectionVerification.findOne({
      correlationId: String(correlationId).trim(),
      userId: new Types.ObjectId(userId),
    }).lean();

    if (!row) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Verification not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Verification status fetched",
      data: {
        correlationId: row.correlationId,
        status: row.status,
        platformKey: row.platformKey,
        email: row.email,
        connectionId: row.connectionId || null,
        partnerMessage: row.partnerMessage || null,
        expiresAt: row.expiresAt,
      },
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

