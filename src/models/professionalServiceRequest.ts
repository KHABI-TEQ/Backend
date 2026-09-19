import { Schema, model, Document, Model, Types } from "mongoose";

export type ProfessionalServiceRequestStatus =
  | "awaiting-acceptance"
  | "awaiting-payment"
  | "awaiting-assignment"
  | "paid-awaiting-assignment"
  | "in-progress"
  | "delivered"
  | "completed"
  | "declined"
  | "cancelled"
  | "payment-failed";

export interface IProfessionalServiceRequest {
  reference: string;
  slug: string;
  serviceName: string;
  category: "lawyer" | "surveyor" | "valuer";
  fulfillment: "document-verification" | "survey-request" | "catalog-request";
  buyerId?: Types.ObjectId;
  professionalId?: Types.ObjectId;
  contact: {
    fullName: string;
    email: string;
    phoneNumber?: string;
  };
  answers: Record<string, unknown>;
  documentUrls: string[];
  customerPrice: number;
  platformFee: number;
  professionalFee: number;
  amountPaid?: number;
  transaction?: Types.ObjectId;
  linkedDocumentVerificationId?: Types.ObjectId;
  linkedSurveyRequestId?: Types.ObjectId;
  status: ProfessionalServiceRequestStatus;
  deliverableUrl?: string;
  deliverableNotes?: string;
  deliveredAt?: Date;
  declineReason?: string;
  offeredTo?: Types.ObjectId[];
  declinedBy?: Types.ObjectId[];
  broadcastAt?: Date;
  unclaimedAdminNotified?: boolean;
}

export interface IProfessionalServiceRequestDoc
  extends IProfessionalServiceRequest,
    Document {}

export type IProfessionalServiceRequestModel = Model<IProfessionalServiceRequestDoc>;

export class ProfessionalServiceRequest {
  private requestModel: IProfessionalServiceRequestModel;

  constructor() {
    const schema = new Schema<IProfessionalServiceRequestDoc>(
      {
        reference: { type: String, required: true, unique: true, index: true },
        slug: { type: String, required: true, index: true },
        serviceName: { type: String, required: true },
        category: {
          type: String,
          enum: ["lawyer", "surveyor", "valuer"],
          required: true,
        },
        fulfillment: {
          type: String,
          enum: ["document-verification", "survey-request", "catalog-request"],
          required: true,
        },
        buyerId: { type: Schema.Types.ObjectId, ref: "Buyer", index: true },
        professionalId: { type: Schema.Types.ObjectId, ref: "User", index: true },
        contact: {
          fullName: { type: String, required: true },
          email: { type: String, required: true, index: true },
          phoneNumber: { type: String },
        },
        answers: { type: Schema.Types.Mixed, default: {} },
        documentUrls: { type: [String], default: [] },
        customerPrice: { type: Number, required: true, min: 0 },
        platformFee: { type: Number, required: true, min: 0 },
        professionalFee: { type: Number, required: true, min: 0 },
        amountPaid: { type: Number, min: 0 },
        transaction: { type: Schema.Types.ObjectId, ref: "NewTransaction" },
        linkedDocumentVerificationId: {
          type: Schema.Types.ObjectId,
          ref: "DocumentVerification",
        },
        linkedSurveyRequestId: {
          type: Schema.Types.ObjectId,
          ref: "SurveyRequest",
        },
        status: {
          type: String,
          enum: [
            "awaiting-acceptance",
            "awaiting-payment",
            "awaiting-assignment",
            "paid-awaiting-assignment",
            "in-progress",
            "delivered",
            "completed",
            "declined",
            "cancelled",
            "payment-failed",
          ],
          default: "awaiting-assignment",
          index: true,
        },
        deliverableUrl: { type: String },
        deliverableNotes: { type: String },
        deliveredAt: { type: Date },
        declineReason: { type: String },
        offeredTo: {
          type: [{ type: Schema.Types.ObjectId, ref: "User" }],
          default: [],
        },
        declinedBy: {
          type: [{ type: Schema.Types.ObjectId, ref: "User" }],
          default: [],
        },
        broadcastAt: { type: Date },
        unclaimedAdminNotified: { type: Boolean, default: false },
      },
      { timestamps: true }
    );

    this.requestModel = model<
      IProfessionalServiceRequestDoc,
      IProfessionalServiceRequestModel
    >("ProfessionalServiceRequest", schema);
  }

  public get model(): IProfessionalServiceRequestModel {
    return this.requestModel;
  }
}
