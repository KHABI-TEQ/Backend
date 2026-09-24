import { Schema, model, models, Document, Model, Types } from "mongoose";
import type { ProfessionalKycStatus } from "./lawyerProfile";

export interface IValuerProfile {
  userId: Types.ObjectId;
  firmName?: string;
  profilePhoto?: string;
  bio?: string;
  licenseNumber?: string;
  certificateKind?: "cac" | "lasrera";
  certificateNumber?: string;
  kycDocuments?: { name: string; url: string }[];
  kycStatus: ProfessionalKycStatus;
  kycNote?: string;
  isMarketplaceVisible: boolean;
}

export interface IValuerProfileDoc extends IValuerProfile, Document {
  createdAt: Date;
  updatedAt: Date;
}
export type IValuerProfileModel = Model<IValuerProfileDoc>;

export class ValuerProfile {
  private _model: IValuerProfileModel;

  constructor() {
    const schema = new Schema<IValuerProfileDoc>(
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
        licenseNumber: { type: String, trim: true },
        certificateKind: { type: String, enum: ["cac", "lasrera"] },
        certificateNumber: { type: String, trim: true },
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
      },
      { timestamps: true }
    );

    this._model =
      (models.ValuerProfile as IValuerProfileModel) ||
      model<IValuerProfileDoc>("ValuerProfile", schema);
  }

  public get model(): IValuerProfileModel {
    return this._model;
  }
}
