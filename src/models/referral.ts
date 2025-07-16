import { Schema, model, Document, Model, Types } from "mongoose";

export interface IReferral {
  referrer: Types.ObjectId;
  referredUser: Types.ObjectId;
  referrerUserType: "Landowners" | "Agent";
  status: "pending" | "qualified" | "rewarded"; // for tracking stages
}

export interface IReferralDoc extends IReferral, Document {}
export type IReferralModel = Model<IReferralDoc>;

export class Referral {
  private ReferralModel: IReferralModel;

  constructor() {
    const schema = new Schema(
      {
        referrer: { type: Schema.Types.ObjectId, required: true, ref: "User" },
        referredUser: {
          type: Schema.Types.ObjectId,
          required: true,
          ref: "User",
        },
        referrerUserType: {
          type: String,
          enum: ["Landowners", "Agent"],
          required: true,
        },
        status: {
          type: String,
          enum: ["pending", "qualified", "rewarded"],
          default: "pending",
        },
      },
      { timestamps: true }
    );

    this.ReferralModel = model<IReferralDoc>("Referral", schema);
  }

  public get model(): IReferralModel {
    return this.ReferralModel;
  }
}
