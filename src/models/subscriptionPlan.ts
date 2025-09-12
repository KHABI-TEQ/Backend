import { Schema, model, Document, Model, Types } from "mongoose";

export type FeatureLimitType = "boolean" | "count" | "unlimited";

export interface IAssignedFeature {
  feature: Types.ObjectId;  // reference to PlanFeature
  type: FeatureLimitType;   // boolean, count, unlimited
  value?: number;           // used if type = "count"
}

export interface IDiscountedPlan {
  name: string;
  price: number;
  durationInDays: number;
  discountPercentage?: number;
}

export interface ISubscriptionPlan {
  name: string; 
  code: string; 
  price: number;
  currency?: string; 
  durationInDays: number; 
  features: IAssignedFeature[];
  isActive?: boolean; 
  isTrial?: boolean;
  discountedPlans?: IDiscountedPlan[];
}

export interface ISubscriptionPlanDoc extends ISubscriptionPlan, Document {}
export type ISubscriptionPlanModel = Model<ISubscriptionPlanDoc>;

export class SubscriptionPlan {
  private subscriptionPlanModel: ISubscriptionPlanModel;

  constructor() {
    const discountedPlanSchema = new Schema<IDiscountedPlan>(
      {
        name: { type: String, required: true },
        price: { type: Number, required: true },
        durationInDays: { type: Number, required: true },
        discountPercentage: { type: Number, default: 0 },
      },
      { _id: false }
    );

    const assignedFeatureSchema = new Schema<IAssignedFeature>(
      {
        feature: { type: Schema.Types.ObjectId, ref: "PlanFeature", required: true },
        type: {
          type: String,
          enum: ["boolean", "count", "unlimited"],
          required: true,
        },
        value: { type: Number, default: 0 },
      },
      { _id: false }
    );

    const schema = new Schema<ISubscriptionPlanDoc>(
      {
        name: { type: String, required: true },
        code: { type: String, required: true, unique: true, uppercase: true, trim: true },
        price: { type: Number, required: true },
        currency: { type: String, default: "NGN" },
        durationInDays: { type: Number, required: true },
        features: { type: [assignedFeatureSchema], default: [] },
        isActive: { type: Boolean, default: true },
        isTrial: { type: Boolean, default: false },
        discountedPlans: { type: [discountedPlanSchema], default: [] },
      },
      { timestamps: true }
    );

    // ✅ Pre-save validation: ensure features exist in PlanFeature
    schema.pre("save", async function (next) {
      const plan = this as ISubscriptionPlanDoc;
      const featureIds = plan.features.map(f => f.feature);

      if (featureIds.length > 0) {
        const existingFeatures = await model("PlanFeature").countDocuments({
          _id: { $in: featureIds },
        });

        if (existingFeatures !== featureIds.length) {
          return next(new Error("One or more features do not exist in PlanFeature"));
        }
      }

      next();
    });

    this.subscriptionPlanModel = model<ISubscriptionPlanDoc>(
      "SubscriptionPlan",
      schema
    );
  }

  public get model(): ISubscriptionPlanModel {
    return this.subscriptionPlanModel;
  }
}
