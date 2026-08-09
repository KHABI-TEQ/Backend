import { Schema, model, models, Document, Model, Types } from "mongoose";

export type ProfessionalKycStatus =
  | "none"
  | "pending"
  | "in_review"
  | "approved"
  | "rejected";

export interface ILawyerProfile {
  userId: Types.ObjectId;
  firmName?: string;
  profilePhoto?: string;
  bio?: string;
  practiceAreas?: string[];
  verificationFee: number;
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

export interface ILawyerProfileDoc extends ILawyerProfile, Document {
  createdAt: Date;
  updatedAt: Date;
}
export type ILawyerProfileModel = Model<ILawyerProfileDoc>;

export class LawyerProfile {
  private _model: ILawyerProfileModel;

  constructor() {
    const schema = new Schema<ILawyerProfileDoc>(
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
        practiceAreas: { type: [String], default: [] },
        verificationFee: { type: Number, default: 0, min: 0 },
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
      (models.LawyerProfile as ILawyerProfileModel) ||
      model<ILawyerProfileDoc>("LawyerProfile", schema);
  }

  public get model(): ILawyerProfileModel {
    return this._model;
  }
}
