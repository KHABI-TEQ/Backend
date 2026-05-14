import { Schema, model, Document, Model } from "mongoose";
import type { SyndicationPropertyTypeValue } from "../common/syndicationPropertyTypes";

export type SyndicationPlatformApplicationStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected";

export interface ISyndicationPlatformApplication {
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  platformName: string;
  platformKeySuggestion: string;
  authType: "api_key" | "oauth2" | "basic" | "partner_login";
  baseUrl: string;
  loginUrl:string;
  /** Property kinds this partner will syndicate (sell, rent, jv, shortlet). */
  acceptedPropertyTypes?: SyndicationPropertyTypeValue[];
  webhookSupport?: boolean;
  docsUrl?: string;
  notes?: string;
  status: SyndicationPlatformApplicationStatus;
  reviewNotes?: string;
  reviewedByAdminId?: string;
  reviewedAt?: Date;
  approvedPlatformId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISyndicationPlatformApplicationDoc
  extends ISyndicationPlatformApplication,
    Document {}
export type ISyndicationPlatformApplicationModel =
  Model<ISyndicationPlatformApplicationDoc>;

export class SyndicationPlatformApplication {
  private _model: ISyndicationPlatformApplicationModel;

  constructor() {
    const schema = new Schema<ISyndicationPlatformApplicationDoc>(
      {
        companyName: { type: String, required: true, trim: true },
        contactName: { type: String, required: true, trim: true },
        contactEmail: { type: String, required: true, trim: true, lowercase: true },
        contactPhone: { type: String },
        platformName: { type: String, required: true, trim: true },
        platformKeySuggestion: {
          type: String,
          required: true,
          trim: true,
          lowercase: true,
          index: true,
        },
        authType: { type: String, enum: ["api_key", "oauth2", "basic", "partner_login"], required: true },
        baseUrl: { type: String, required: true, trim: true },
        loginUrl: { type: String, required: true, trim: true },
        acceptedPropertyTypes: {
          type: [{ type: String, enum: ["sell", "rent", "jv", "shortlet"] }],
        },
        webhookSupport: { type: Boolean, default: true },
        docsUrl: { type: String },
        notes: { type: String },
        status: {
          type: String,
          enum: ["pending", "under_review", "approved", "rejected"],
          default: "pending",
          index: true,
        },
        reviewNotes: { type: String },
        reviewedByAdminId: { type: String },
        reviewedAt: { type: Date },
        approvedPlatformId: { type: String },
      },
      { timestamps: true }
    );

    this._model = model<ISyndicationPlatformApplicationDoc>(
      "SyndicationPlatformApplication",
      schema
    );
  }

  public get model(): ISyndicationPlatformApplicationModel {
    return this._model;
  }
}

