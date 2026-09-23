import { Schema, model, models, Document, Model, Types } from "mongoose";

export type OffPlanProjectStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "live"
  | "rejected";

export interface IOffPlanProject {
  developerId: Types.ObjectId;
  name: string;
  location: {
    state?: string;
    localGovtArea?: string;
    area?: string;
    streetAddress?: string;
  };
  developmentType?: string;
  developmentStage?: string;
  unitCount?: number;
  unitTypes?: string[];
  priceMin?: number;
  priceMax?: number;
  expectedCompletionDate?: string;
  availableUnits?: number;
  documents?: { name: string; url: string }[];
  status: OffPlanProjectStatus;
  reviewNote?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  submittedAt?: Date;
  liveAt?: Date;
  marketplacePropertyId?: Types.ObjectId;
}

export interface IOffPlanProjectDoc extends IOffPlanProject, Document {
  createdAt: Date;
  updatedAt: Date;
}
export type IOffPlanProjectModel = Model<IOffPlanProjectDoc>;

export class OffPlanProject {
  private _model: IOffPlanProjectModel;

  constructor() {
    const schema = new Schema<IOffPlanProjectDoc>(
      {
        developerId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
          index: true,
        },
        name: { type: String, required: true, trim: true },
        location: {
          state: { type: String, trim: true },
          localGovtArea: { type: String, trim: true },
          area: { type: String, trim: true },
          streetAddress: { type: String, trim: true },
        },
        developmentType: { type: String, trim: true },
        developmentStage: { type: String, trim: true },
        unitCount: { type: Number, min: 0 },
        unitTypes: { type: [String], default: [] },
        priceMin: { type: Number, min: 0 },
        priceMax: { type: Number, min: 0 },
        expectedCompletionDate: { type: String, trim: true },
        availableUnits: { type: Number, min: 0 },
        documents: [
          {
            name: { type: String, required: true },
            url: { type: String, required: true },
          },
        ],
        status: {
          type: String,
          enum: ["draft", "submitted", "under_review", "approved", "live", "rejected"],
          default: "draft",
          index: true,
        },
        reviewNote: { type: String, trim: true },
        reviewedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
        reviewedAt: { type: Date },
        submittedAt: { type: Date },
        liveAt: { type: Date },
        marketplacePropertyId: { type: Schema.Types.ObjectId, ref: "Property" },
      },
      { timestamps: true }
    );

    schema.index({ developerId: 1, status: 1 });

    this._model =
      (models.OffPlanProject as IOffPlanProjectModel) ||
      model<IOffPlanProjectDoc>("OffPlanProject", schema);
  }

  public get model(): IOffPlanProjectModel {
    return this._model;
  }
}
