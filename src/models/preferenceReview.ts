import { Schema, model, models, Document, Model, Types } from "mongoose";

export const BUDGET_FIT_VALUES = ["too_low", "moderate", "too_high"] as const;
/** New agent reviews: budget is either too low or (default) moderate. */
export const REVIEW_BUDGET_FIT_VALUES = ["too_low", "moderate"] as const;
export const AVAILABILITY_VALUES = ["scarce", "typical", "plentiful"] as const;
export const SPEC_FIT_VALUES = ["underspec", "typical", "overspec"] as const;

export type BudgetFit = (typeof BUDGET_FIT_VALUES)[number];
export type AvailabilityFit = (typeof AVAILABILITY_VALUES)[number];
export type SpecFit = (typeof SPEC_FIT_VALUES)[number];

export interface IPreferenceReview {
  preferenceId: Types.ObjectId;
  agentId: Types.ObjectId;
  budgetFit: BudgetFit;
  availability: AvailabilityFit;
  specFit: SpecFit;
  suggestedBudget?: { min: number; max: number; currency: string };
  suggestedSpec?: { minBedrooms: string };
  availabilityNote?: string;
  specNote?: string;
  preferenceType: string;
  propertyType?: string;
  state: string;
  lgas: string[];
  areas: string[];
  estates: string[];
  budgetMin?: number;
  budgetMax?: number;
  budgetMid?: number;
}

export interface IPreferenceReviewDoc extends IPreferenceReview, Document {
  createdAt: Date;
  updatedAt: Date;
}

export type IPreferenceReviewModel = Model<IPreferenceReviewDoc>;

export class PreferenceReview {
  private preferenceReviewModel: IPreferenceReviewModel;

  constructor() {
    const schema = new Schema<IPreferenceReviewDoc>(
      {
        preferenceId: {
          type: Schema.Types.ObjectId,
          ref: "Preference",
          required: true,
        },
        agentId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        budgetFit: {
          type: String,
          enum: BUDGET_FIT_VALUES,
          required: true,
        },
        availability: {
          type: String,
          enum: AVAILABILITY_VALUES,
          default: "typical",
        },
        specFit: {
          type: String,
          enum: SPEC_FIT_VALUES,
          default: "typical",
        },
        suggestedBudget: {
          min: Number,
          max: Number,
          currency: { type: String, default: "NGN" },
        },
        suggestedSpec: {
          minBedrooms: String,
        },
        availabilityNote: { type: String, default: "" },
        specNote: { type: String, default: "" },
        preferenceType: { type: String, required: true },
        propertyType: { type: String, default: "" },
        state: { type: String, required: true },
        lgas: { type: [String], default: [] },
        areas: { type: [String], default: [] },
        estates: { type: [String], default: [] },
        budgetMin: Number,
        budgetMax: Number,
        budgetMid: Number,
      },
      { timestamps: true }
    );

    schema.index({ agentId: 1, preferenceId: 1 }, { unique: true });
    schema.index({ preferenceId: 1 });
    schema.index({ preferenceType: 1, propertyType: 1, state: 1, lgas: 1 });
    schema.index({ areas: 1 });
    schema.index({ estates: 1 });

    this.preferenceReviewModel =
      models.PreferenceReview ||
      model<IPreferenceReviewDoc>("PreferenceReview", schema);
  }

  public get model(): IPreferenceReviewModel {
    return this.preferenceReviewModel;
  }
}
