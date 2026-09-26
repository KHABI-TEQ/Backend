import { Schema, model, models, Document, Model, Types } from "mongoose";

export type SurveyRequestStatus =
  | "awaiting-acceptance"
  | "awaiting-payment"
  | "declined"
  | "pending"
  | "payment-approved"
  | "payment-failed"
  | "in-progress"
  | "completed"
  | "cancelled";

export interface ISurveyRequest {
  buyerId: Types.ObjectId;
  surveyorId: Types.ObjectId;
  serviceType: "plan-verification" | "site-survey";
  propertyAddress?: string;
  surveyPlanUrl?: string;
  notes?: string;
  amountPaid?: number;
  transaction?: Types.ObjectId;
  status: SurveyRequestStatus;
  report?: {
    description?: string;
    documentUrl?: string;
    completedAt?: Date;
  };
  respondedAt?: Date;
  declineReason?: string;
  /** marketplace = accept-then-pay; public-page = immediate Paystack */
  source?: "marketplace" | "public-page";
  inspectionId?: Types.ObjectId;
  propertyId?: Types.ObjectId;
  preferenceId?: Types.ObjectId;
}

export interface ISurveyRequestDoc extends ISurveyRequest, Document {
  createdAt: Date;
  updatedAt: Date;
}
export type ISurveyRequestModel = Model<ISurveyRequestDoc>;

export class SurveyRequest {
  private _model: ISurveyRequestModel;

  constructor() {
    const schema = new Schema<ISurveyRequestDoc>(
      {
        buyerId: {
          type: Schema.Types.ObjectId,
          ref: "Buyer",
          required: true,
          index: true,
        },
        surveyorId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
          index: true,
        },
        serviceType: {
          type: String,
          enum: ["plan-verification", "site-survey"],
          required: true,
        },
        propertyAddress: { type: String, trim: true },
        surveyPlanUrl: { type: String, trim: true },
        notes: { type: String, trim: true },
        amountPaid: { type: Number, min: 0 },
        transaction: { type: Schema.Types.ObjectId, ref: "NewTransaction" },
        status: {
          type: String,
          enum: [
            "awaiting-acceptance",
            "awaiting-payment",
            "declined",
            "pending",
            "payment-approved",
            "payment-failed",
            "in-progress",
            "completed",
            "cancelled",
          ],
          default: "awaiting-acceptance",
          index: true,
        },
        report: {
          description: { type: String },
          documentUrl: { type: String },
          completedAt: { type: Date },
        },
        respondedAt: { type: Date },
        declineReason: { type: String, trim: true },
        source: {
          type: String,
          enum: ["marketplace", "public-page"],
          default: "marketplace",
          index: true,
        },
        inspectionId: { type: Schema.Types.ObjectId, ref: "InspectionBooking", index: true },
        propertyId: { type: Schema.Types.ObjectId, ref: "Property", index: true },
        preferenceId: { type: Schema.Types.ObjectId, ref: "Preference", index: true },
      },
      { timestamps: true }
    );

    this._model =
      (models.SurveyRequest as ISurveyRequestModel) ||
      model<ISurveyRequestDoc>("SurveyRequest", schema);
  }

  public get model(): ISurveyRequestModel {
    return this._model;
  }
}
