// models/referral.commission.ts

import { Schema, model, Document, Model, Types } from "mongoose";

export interface IReferralCommission {
  referrer: Types.ObjectId;
  referredUser: Types.ObjectId;
  type: "landlord_referral" | "agent_referral";
  status: "pending" | "approved" | "rejected";
  amount: number;
  note?: string;
  approvedAt?: Date;
  approvedBy?: Types.ObjectId;
  rejectedAt?: Date;
  rejectedBy?: Types.ObjectId;
}

export interface IReferralCommissionDoc extends IReferralCommission, Document {}
export type IReferralCommissionModel = Model<IReferralCommissionDoc>;

export class ReferralCommission {
  private ReferralCommissionModel: IReferralCommissionModel;

  constructor() {
    const schema = new Schema<IReferralCommissionDoc>(
      {
        referrer: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        referredUser: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        type: {
          type: String,
          enum: ["landlord_referral", "agent_referral"],
          required: true,
        },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        amount: { type: Number, required: true },
        note: { type: String },
        approvedAt: { type: Date },
        approvedBy: {
          type: Schema.Types.ObjectId,
          ref: "Admin",
        },
        rejectedAt: { type: Date },
        rejectedBy: {
          type: Schema.Types.ObjectId,
          ref: "Admin",
        },
      },
      {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
      }
    );

    this.ReferralCommissionModel = model<IReferralCommissionDoc>(
      "ReferralCommission",
      schema
    );
  }

  public get model(): IReferralCommissionModel {
    return this.ReferralCommissionModel;
  }
}
