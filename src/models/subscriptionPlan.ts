import { Schema, model, Document, Model } from "mongoose";

export interface ISubscriptionPlan {
  name: string; // e.g., "Monthly Plan"
  code: string; // e.g., "MONTHLY", unique identifier
  price: number; // amount in NGN
  currency?: string; // default NGN
  durationInDays: number; // e.g., 30, 90, 365
  features: string[]; // array of features unlocked
  isActive?: boolean; // toggle if plan is available
}

export interface ISubscriptionPlanDoc extends ISubscriptionPlan, Document {}

export type ISubscriptionPlanModel = Model<ISubscriptionPlanDoc>;

export class SubscriptionPlan {
  private subscriptionPlanModel: ISubscriptionPlanModel;

  constructor() {
    const schema = new Schema<ISubscriptionPlanDoc>(
      {
        name: {
          type: String,
          required: true,
        },
        code: {
          type: String,
          required: true,
          unique: true,
          uppercase: true,
          trim: true,
        },
        price: {
          type: Number,
          required: true,
        },
        currency: {
          type: String,
          default: "NGN",
        },
        durationInDays: {
          type: Number,
          required: true,
        },
        features: {
          type: [String],
          default: [],
        },
        isActive: {
          type: Boolean,
          default: true,
        },
      },
      { timestamps: true }
    );

    this.subscriptionPlanModel = model<ISubscriptionPlanDoc>(
      "SubscriptionPlan",
      schema
    );
  }

  public get model(): ISubscriptionPlanModel {
    return this.subscriptionPlanModel;
  }
}
