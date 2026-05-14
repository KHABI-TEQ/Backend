import { Schema, model, Document, Model, Types } from "mongoose";

export type PlatformAuthType = "api_key" | "oauth2" | "basic" | "partner_login";
export type PlatformConnectionStatus = "active" | "inactive" | "error";

export interface IPlatformConnection {
  userId: Types.ObjectId;
  platformId?: Types.ObjectId;
  platformKey: string;
  platformName: string;
  status: PlatformConnectionStatus;
  authType: PlatformAuthType;
  credentials: {
    accessToken?: string;
    refreshToken?: string;
    apiKey?: string;
    /** Partner platform login email (with authType partner_login). */
    email?: string;
    /** Partner platform password (with authType partner_login); never returned in list APIs. */
    password?: string;
    /** Partner stable user id after successful auth callback (optional). */
    externalUserId?: string;
    tokenExpiresAt?: Date;
  };
  config?: {
    baseUrl?: string;
    outboundEnabled?: boolean;
    inboundWebhookEnabled?: boolean;
  };
  lastSyncAt?: Date;
  lastError?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPlatformConnectionDoc extends IPlatformConnection, Document {}
export type IPlatformConnectionModel = Model<IPlatformConnectionDoc>;

export class PlatformConnection {
  private _model: IPlatformConnectionModel;

  constructor() {
    const schema = new Schema<IPlatformConnectionDoc>(
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        platformId: { type: Schema.Types.ObjectId, ref: "SyndicationPlatform", index: true },
        platformKey: { type: String, required: true, trim: true, lowercase: true },
        platformName: { type: String, required: true, trim: true },
        status: { type: String, enum: ["active", "inactive", "error"], default: "active" },
        authType: { type: String, enum: ["api_key", "oauth2", "basic", "partner_login"], required: true },
        credentials: {
          accessToken: { type: String },
          refreshToken: { type: String },
          apiKey: { type: String },
          email: { type: String, trim: true, lowercase: true },
          password: { type: String },
          externalUserId: { type: String, trim: true },
          tokenExpiresAt: { type: Date },
        },
        config: {
          baseUrl: { type: String },
          outboundEnabled: { type: Boolean, default: true },
          inboundWebhookEnabled: { type: Boolean, default: true },
        },
        lastSyncAt: { type: Date },
        lastError: { type: String },
      },
      { timestamps: true }
    );

    schema.index({ userId: 1, platformId: 1 }, { unique: true, sparse: true });
    schema.index({ userId: 1, platformKey: 1 }, { unique: true });

    this._model = model<IPlatformConnectionDoc>("PlatformConnection", schema);
  }

  public get model(): IPlatformConnectionModel {
    return this._model;
  }
}
