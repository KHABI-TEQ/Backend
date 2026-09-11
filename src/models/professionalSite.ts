import { Schema, model, models, Document, Model, Types } from "mongoose";

export type ProfessionalSiteKind = "lawyer" | "surveyor";
export type ProfessionalSiteStatus = "paused" | "running" | "deleted";

export interface IProfessionalSite {
  kind: ProfessionalSiteKind;
  ownerId: Types.ObjectId;
  publicSlug: string;
  status: ProfessionalSiteStatus;
  title: string;
  tagline?: string;
  logoUrl?: string;
  primaryColor?: string;
  about?: string;
  ctaLabel?: string;
  customDomain?: string;
  customDomainStatus?: "none" | "pending" | "live" | "disabled";
  customDomainExpiresAt?: Date;
  customDomainGraceEndsAt?: Date;
  customDomainLastRenewedAt?: Date;
}

export interface IProfessionalSiteDoc extends IProfessionalSite, Document {
  createdAt: Date;
  updatedAt: Date;
}

export type IProfessionalSiteModel = Model<IProfessionalSiteDoc>;

export class ProfessionalSite {
  private _model: IProfessionalSiteModel;

  constructor() {
    const schema = new Schema<IProfessionalSiteDoc>(
      {
        kind: {
          type: String,
          enum: ["lawyer", "surveyor"],
          required: true,
          index: true,
        },
        ownerId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
          unique: true,
          index: true,
        },
        publicSlug: {
          type: String,
          required: true,
          unique: true,
          lowercase: true,
          trim: true,
          index: true,
        },
        status: {
          type: String,
          enum: ["paused", "running", "deleted"],
          default: "paused",
          index: true,
        },
        title: { type: String, required: true, trim: true },
        tagline: { type: String, trim: true },
        logoUrl: { type: String, trim: true },
        primaryColor: { type: String, trim: true, default: "#09391C" },
        about: { type: String, trim: true },
        ctaLabel: { type: String, trim: true },
        customDomain: {
          type: String,
          trim: true,
          lowercase: true,
          sparse: true,
          unique: true,
        },
        customDomainStatus: {
          type: String,
          enum: ["none", "pending", "live", "disabled"],
          default: "none",
          index: true,
        },
        customDomainExpiresAt: { type: Date },
        customDomainGraceEndsAt: { type: Date },
        customDomainLastRenewedAt: { type: Date },
      },
      { timestamps: true }
    );

    this._model =
      (models.ProfessionalSite as IProfessionalSiteModel) ||
      model<IProfessionalSiteDoc>("ProfessionalSite", schema);
  }

  public get model(): IProfessionalSiteModel {
    return this._model;
  }
}
