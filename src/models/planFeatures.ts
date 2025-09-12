import { Schema, model, Document, Model } from "mongoose";

export interface IPlanFeature {
  key: string;       // unique identifier: e.g., "LISTINGS"
  label: string;     // e.g., "Number of Listings"
  isActive: boolean; // toggle availability
}

export interface IPlanFeatureDoc extends IPlanFeature, Document {}
export type IPlanFeatureModel = Model<IPlanFeatureDoc>;

export class PlanFeature {
  private planFeatureModel: IPlanFeatureModel;

  constructor() {
    const schema = new Schema<IPlanFeatureDoc>(
      {
        key: { type: String, required: true, unique: true, uppercase: true, trim: true },
        label: { type: String, required: true },
        isActive: { type: Boolean, default: true },
      },
      { timestamps: true }
    );

    this.planFeatureModel = model<IPlanFeatureDoc>("PlanFeature", schema);
  }

  public get model(): IPlanFeatureModel {
    return this.planFeatureModel;
  }
}
