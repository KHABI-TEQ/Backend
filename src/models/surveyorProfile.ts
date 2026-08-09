import { Schema, model, models, Document, Model, Types } from "mongoose";
import type { ProfessionalKycStatus } from "./lawyerProfile";

export type SurveyorServiceType = "plan-verification" | "site-survey";

export interface ISurveyorProfile {
  userId: Types.ObjectId;
  firmName?: string;
  profilePhoto?: string;
  bio?: string;
  serviceTypes?: SurveyorServiceType[];
  surveyFee: number;
  licenseNumber?: string;
  kycDocuments?: { name: string; url: string }[];
  kycStatus: ProfessionalKycStatus;
  kycNote?: string;
  isMarketplaceVisible: boolean;
  paystackSubaccountCode?: string;
  paystackSubaccountId?: string;
  bankDetails?: {
    businessName?: string;
    bankCode?: string;
    accountNumber?: string;
    accountName?: string;
  };
}

export interface ISurveyorProfileDoc extends ISurveyorProfile, Document {
  createdAt: Date;
  updatedAt: Date;
}
export type ISurveyorProfileModel = Model<ISurveyorProfileDoc>;

export class SurveyorProfile {
  private _model: ISurveyorProfileModel;

  constructor() {
    const schema = new Schema<ISurveyorProfileDoc>(
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
          unique: true,
          index: true,
        },
        firmName: { type: String, trim: true },
        profilePhoto: { type: String, trim: true },
        bio: { type: String, trim: true },
        serviceTypes: {
          type: [String],
          enum: ["plan-verification", "site-survey"],
          default: ["plan-verification"],
        },
        surveyFee: { type: Number, default: 0, min: 0 },
        licenseNumber: { type: String, trim: true },
        kycDocuments: [
          {
            name: { type: String, required: true },
            url: { type: String, required: true },
          },
        ],
        kycStatus: {
          type: String,
          enum: ["none", "pending", "in_review", "approved", "rejected"],
          default: "none",
          index: true,
        },
        kycNote: { type: String, trim: true },
        isMarketplaceVisible: { type: Boolean, default: false, index: true },
        paystackSubaccountCode: { type: String, trim: true },
        paystackSubaccountId: { type: String, trim: true },
        bankDetails: {
          businessName: { type: String, trim: true },
          bankCode: { type: String, trim: true },
          accountNumber: { type: String, trim: true },
          accountName: { type: String, trim: true },
        },
      },
      { timestamps: true }
    );

    this._model =
      (models.SurveyorProfile as ISurveyorProfileModel) ||
      model<ISurveyorProfileDoc>("SurveyorProfile", schema);
  }

  public get model(): ISurveyorProfileModel {
    return this._model;
  }
}
