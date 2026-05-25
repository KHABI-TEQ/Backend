import { Schema, model, Document, Model } from "mongoose";
import type { SyndicationPropertyTypeValue } from "../common/syndicationPropertyTypes";

export type SyndicationPlatformStatus = "approved" | "disabled";
export type SyndicationAuthType = "api_key" | "oauth2" | "basic" | "partner_login";

export interface ISyndicationPlatform {
  platformKey: string;
  platformName: string;
  description?: string;
  status: SyndicationPlatformStatus;
  authType: SyndicationAuthType;
  /** Listing kinds this partner accepts for outbound syndication (sell, rent, jv, shortlet). Omitted or null = all types (legacy). Empty array = none. */
  acceptedPropertyTypes?: SyndicationPropertyTypeValue[];
  config: {
    baseUrl: string;
    loginUrl?: string;
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
        authType: { type: String, enum: ["api_key", "oauth2", "basic", "partner_login"], required: true },
        acceptedPropertyTypes: {
          type: [{ type: String, enum: ["sell", "rent", "jv", "shortlet", "off-plan"] }],
          default: undefined,
        },
        config: {
          baseUrl: { type: String, required: true },
          /** Full URL for hub→partner credential probe POST (JSON { email, password }). Defaults to baseUrl if unset. */
          loginUrl: { type: String },
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
