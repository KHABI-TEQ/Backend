import { Schema, model, Document, Model, Types } from "mongoose";

export type PetitionStatus = "submitted" | "case_opened" | "rejected" | "withdrawn";

export interface IPetitionAttachment {
  fileName: string;
  url: string;
  uploadedAt?: Date;
}

export interface IPetitionBuyerSnapshot {
  fullName: string;
  email: string;
  phoneNumber?: string;
}

export interface IPetitionRespondent {
  name: string;
  email?: string;
  phoneNumber?: string;
  type: "developer" | "agent" | "property_owner" | "other";
}

export interface IPetition {
  petitionNumber: string;
  registrationId: any;
  transactionReference: string;
  buyerId: any;
  buyer: IPetitionBuyerSnapshot;
  respondent: IPetitionRespondent;
  subject: string;
  description: string;
  amountInvolved: number;
  attachments: IPetitionAttachment[];
  status: PetitionStatus;
  caseId?: any;
  submittedAt: Date;
  reviewNotes?: string;
  reviewedBy?: any;
  reviewedAt?: Date;
}

export interface IPetitionDoc extends IPetition, Document {}
export type IPetitionModel = Model<IPetitionDoc>;

export class Petition {
  private _model: IPetitionModel;

  constructor() {
    const schema = new Schema<IPetitionDoc>(
      {
        petitionNumber: { type: String, required: true, unique: true, index: true },
        registrationId: { type: Schema.Types.ObjectId, ref: "TransactionRegistration", required: true, index: true },
        transactionReference: { type: String, required: true, index: true },
        buyerId: { type: Schema.Types.ObjectId, ref: "Buyer", required: true, index: true },
        buyer: {
          fullName: { type: String, required: true },
          email: { type: String, required: true, lowercase: true, trim: true, index: true },
          phoneNumber: { type: String, required: false },
        },
        respondent: {
          name: { type: String, required: true },
          email: { type: String, required: false, lowercase: true, trim: true },
          phoneNumber: { type: String, required: false },
          type: {
            type: String,
            enum: ["developer", "agent", "property_owner", "other"],
            default: "developer",
          },
        },
        subject: { type: String, required: true, trim: true },
        description: { type: String, required: true },
        amountInvolved: { type: Number, required: true, min: 0 },
        attachments: [
          {
            fileName: { type: String, required: true },
            url: { type: String, required: true },
            uploadedAt: { type: Date, default: Date.now },
          },
        ],
        status: {
          type: String,
          enum: ["submitted", "case_opened", "rejected", "withdrawn"],
          default: "submitted",
          index: true,
        },
        caseId: { type: Schema.Types.ObjectId, ref: "Case", required: false, index: true },
        submittedAt: { type: Date, default: Date.now },
        reviewNotes: { type: String, required: false },
        reviewedBy: { type: Schema.Types.ObjectId, ref: "Admin", required: false },
        reviewedAt: { type: Date, required: false },
      },
      { timestamps: true }
    );

    schema.index({ createdAt: -1 });

    this._model = model<IPetitionDoc>("Petition", schema);
  }

  public get model(): IPetitionModel {
    return this._model;
  }
}
