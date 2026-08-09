import { Schema, model, models, Document, Model, Types } from "mongoose";

export interface ISurveyRequest {
  buyerId: Types.ObjectId;
  surveyorId: Types.ObjectId;
  serviceType: "plan-verification" | "site-survey";
  propertyAddress?: string;
  surveyPlanUrl?: string;
  notes?: string;
  amountPaid: number;
  transaction?: Types.ObjectId;
  status:
    | "pending"
    | "payment-approved"
    | "payment-failed"
    | "in-progress"
    | "completed"
    | "cancelled";
  report?: {
    description?: string;
    documentUrl?: string;
    completedAt?: Date;
  };
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
        amountPaid: { type: Number, required: true, min: 0 },
        transaction: { type: Schema.Types.ObjectId, ref: "NewTransaction" },
        status: {
          type: String,
          enum: [
            "pending",
            "payment-approved",
            "payment-failed",
            "in-progress",
            "completed",
            "cancelled",
          ],
          default: "pending",
          index: true,
        },
        report: {
          description: { type: String },
          documentUrl: { type: String },
          completedAt: { type: Date },
        },
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
