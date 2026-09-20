import { Schema, model, Document, Model, Types } from "mongoose";
import type { SearchInsuranceClaimStatus } from "../common/constants/searchInsuranceCatalog";

export type SearchInsuranceEvidenceKind = "image" | "document" | "other";

export interface ISearchInsuranceEvidence {
  url: string;
  publicId?: string;
  kind?: SearchInsuranceEvidenceKind;
  name?: string;
}

export interface ISearchInsuranceClaim {
  policy: Types.ObjectId;
  preference: Types.ObjectId;
  buyer: Types.ObjectId;
  practitionerUser?: Types.ObjectId;
  practitionerName?: string;
  description: string;
  evidence: ISearchInsuranceEvidence[];
  status: SearchInsuranceClaimStatus;
  adminNotes?: string;
  approvedAmount?: number;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
}

export interface ISearchInsuranceClaimDoc
  extends ISearchInsuranceClaim,
    Document {
  createdAt: Date;
  updatedAt: Date;
}

export type ISearchInsuranceClaimModel = Model<ISearchInsuranceClaimDoc>;

export class SearchInsuranceClaim {
  private searchInsuranceClaimModel: ISearchInsuranceClaimModel;

  constructor() {
    const schema = new Schema<ISearchInsuranceClaimDoc>(
      {
        policy: {
          type: Schema.Types.ObjectId,
          ref: "SearchInsurancePolicy",
          required: true,
          index: true,
        },
        preference: {
          type: Schema.Types.ObjectId,
          ref: "Preference",
          required: true,
        },
        buyer: {
          type: Schema.Types.ObjectId,
          ref: "Buyer",
          required: true,
          index: true,
        },
        practitionerUser: { type: Schema.Types.ObjectId, ref: "User" },
        practitionerName: { type: String, trim: true },
        description: { type: String, required: true, trim: true },
        evidence: [
          {
            url: { type: String, required: true },
            publicId: { type: String },
            kind: {
              type: String,
              enum: ["image", "document", "other"],
              default: "other",
            },
            name: { type: String },
          },
        ],
        status: {
          type: String,
          enum: ["submitted", "under_review", "approved", "rejected", "paid"],
          default: "submitted",
          index: true,
        },
        adminNotes: { type: String, trim: true },
        approvedAmount: { type: Number },
        reviewedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
        reviewedAt: { type: Date },
      },
      { timestamps: true }
    );

    schema.index({ buyer: 1, createdAt: -1 });
    schema.index({ status: 1, createdAt: -1 });

    this.searchInsuranceClaimModel = model<ISearchInsuranceClaimDoc>(
      "SearchInsuranceClaim",
      schema
    );
  }

  public get model(): ISearchInsuranceClaimModel {
    return this.searchInsuranceClaimModel;
  }
}
