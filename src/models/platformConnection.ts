import { Schema, model, Document, Model, Types } from "mongoose";

export type PlatformAuthType = "api_key" | "oauth2" | "basic";
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
        authType: { type: String, enum: ["api_key", "oauth2", "basic"], required: true },
        credentials: {
          accessToken: { type: String },
          refreshToken: { type: String },
          apiKey: { type: String },
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
