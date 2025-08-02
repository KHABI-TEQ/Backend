import { Schema, model, Document, Types } from "mongoose";

export interface IReferralLog extends Document {
  referrerId: Types.ObjectId;
  referredUserId: Types.ObjectId;
  rewardType:
    | "subscription"
    | "listing"
    | "inspection"
    | "user"
    | "custom"
    | "registration_bonus"
    | "review_submitted"
    | "document_verified"
    | "property_sold"
    | "invite_chain_bonus"
    | "target_achieved"
    | "campaign_bonus";
  rewardAmount?: number;
  rewardStatus: "pending" | "granted" | "failed";
  triggerAction?: string; // E.g., 'premium_plan', 'listing_posted', 'review_added'
  meta?: Record<string, any>; // To store extra context (e.g., planId, txnRef, campaignCode, etc.)
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralLogSchema = new Schema<IReferralLog>(
  {
    referrerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    referredUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rewardType: {
      type: String,
      enum: [
        "subscription",
        "listing",
        "inspection",
        "user",
        "custom",
        "registration_bonus",
        "review_submitted",
        "document_verified",
        "property_sold",
        "invite_chain_bonus",
        "target_achieved",
        "campaign_bonus",
      ],
      required: true,
    },
    rewardAmount: {
      type: Number,
      default: 0,
    },
    rewardStatus: {
      type: String,
      enum: ["pending", "granted", "failed"],
      default: "pending",
    },
    triggerAction: {
      type: String,
      required: false,
    },
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
    note: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const ReferralLogModel = model<IReferralLog>("ReferralLog", ReferralLogSchema);
