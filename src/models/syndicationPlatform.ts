import { Schema, model, Document, Model } from "mongoose";

export type SyndicationPlatformStatus = "approved" | "disabled";
export type SyndicationAuthType = "api_key" | "oauth2" | "basic";

export interface ISyndicationPlatform {
  platformKey: string;
  platformName: string;
  description?: string;
  status: SyndicationPlatformStatus;
  authType: SyndicationAuthType;
  config: {
    baseUrl: string;
    outboundEnabled: boolean;
    inboundWebhookEnabled: boolean;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISyndicationPlatformDoc extends ISyndicationPlatform, Document {}
export type ISyndicationPlatformModel = Model<ISyndicationPlatformDoc>;

export class SyndicationPlatform {
  private _model: ISyndicationPlatformModel;

  constructor() {
    const schema = new Schema<ISyndicationPlatformDoc>(
      {
        platformKey: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
        platformName: { type: String, required: true, trim: true },
        description: { type: String },
        status: { type: String, enum: ["approved", "disabled"], default: "approved", index: true },
        authType: { type: String, enum: ["api_key", "oauth2", "basic"], required: true },
        config: {
          baseUrl: { type: String, required: true },
          outboundEnabled: { type: Boolean, default: true },
          inboundWebhookEnabled: { type: Boolean, default: true },
        },
      },
      { timestamps: true }
    );

    this._model = model<ISyndicationPlatformDoc>("SyndicationPlatform", schema);
  }

  public get model(): ISyndicationPlatformModel {
    return this._model;
  }
}
