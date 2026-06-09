import { Schema, model, models, Document, Model, Types } from "mongoose";
import type { PublisherKycStatus, PublisherKycUserType } from "../common/kycTypes";

export interface IPublisherProfile {
  userId: Types.ObjectId;
  userType: PublisherKycUserType;
  address?: {
    street: string;
    homeNo: string;
    state: string;
    localGovtArea: string;
  };
  regionOfOperation?: string[];
  practitionerType?: "Individual" | "Company";
  companyDetails?: {
    companyName?: string;
    cacNumber?: string;
  };
  meansOfId?: {
    name: string;
    docImg: string[];
  }[];
  kycData?: {
    licenseOrRegistrationNumber?: string;
    profileBio?: string;
    specializations?: string[];
    languagesSpoken?: string[];
    servicesOffered?: string[];
    achievements?: {
      title: string;
      description?: string;
      fileUrl?: string;
      dateAwarded?: Date;
    }[];
  };
  kycNote?: string;
  kycStatus: PublisherKycStatus;
}

export interface IPublisherProfileDoc extends IPublisherProfile, Document {}
export type IPublisherProfileModel = Model<IPublisherProfileDoc>;

export class PublisherProfile {
  private _model: IPublisherProfileModel;

  constructor() {
    const schema = new Schema<IPublisherProfileDoc>(
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
        userType: {
          type: String,
          enum: ["Agent", "Developer", "Landowners"],
          required: true,
        },
        address: {
          street: { type: String },
          homeNo: { type: String },
          state: { type: String },
          localGovtArea: { type: String },
        },
        regionOfOperation: { type: [String], default: [] },
        practitionerType: { type: String, enum: ["Individual", "Company"] },
        companyDetails: {
          companyName: { type: String },
          cacNumber: { type: String },
        },
        meansOfId: [
          {
            name: { type: String },
            docImg: { type: [String] },
          },
        ],
        kycData: {
          licenseOrRegistrationNumber: { type: String },
          profileBio: { type: String },
          specializations: { type: [String], default: [] },
          languagesSpoken: { type: [String], default: [] },
          servicesOffered: { type: [String], default: [] },
          achievements: {
            type: [
              {
                title: { type: String, required: true },
                description: { type: String },
                fileUrl: { type: String },
                dateAwarded: { type: Date },
              },
            ],
            default: [],
          },
        },
        kycNote: { type: String, trim: true },
        kycStatus: {
          type: String,
          enum: ["none", "pending", "in_review", "approved", "rejected"],
          default: "none",
          index: true,
        },
      },
      { timestamps: true }
    );

    this._model =
      (models.PublisherProfile as IPublisherProfileModel) ||
      model<IPublisherProfileDoc>("PublisherProfile", schema);
  }

  public get model(): IPublisherProfileModel {
    return this._model;
  }
}
