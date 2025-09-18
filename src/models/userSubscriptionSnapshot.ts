import { Schema, model, Document, Model, Types } from "mongoose";

/**
 * Interfaces
 */ 
export interface IUserAssignedFeature {
  feature: Types.ObjectId; // PlanFeature ref
  type: "boolean" | "count" | "unlimited";
  value?: number;          // initial value (limit)
  remaining?: number;      // usage left
} 
 
export type SubscriptionSnapshotStatus = 'pending' | 'active' | 'inactive' | 'cancelled' | 'expired';

export interface IUserSubscriptionSnapshot {
  user: Types.ObjectId;                // the subscriber
  plan: Types.ObjectId;                // SubscriptionPlan ref
  status: SubscriptionSnapshotStatus;
  startedAt: Date;
  expiresAt: Date;
  features?: IUserAssignedFeature[];    // features cloned from plan
  transaction: Types.ObjectId;
  autoRenew?: boolean;
  meta?: Record<string, any>;
} 

export interface IUserSubscriptionSnapshotDoc
  extends IUserSubscriptionSnapshot,
    Document {}
export type IUserSubscriptionSnapshotModel =
  Model<IUserSubscriptionSnapshotDoc>;

/**
 * Schema & Model Class
 */
export class UserSubscriptionSnapshot {
  private userSubscriptionSnapshotModel: IUserSubscriptionSnapshotModel;

  constructor() {
    // Embedded schema for features
    const userAssignedFeatureSchema = new Schema<IUserAssignedFeature>(
      {
        feature: {
          type: Schema.Types.ObjectId,
          ref: "PlanFeature",
          required: true,
        },
        type: {
          type: String,
          enum: ["boolean", "count", "unlimited"],
          required: true,
        },
        value: { type: Number, default: 0 },
        remaining: { type: Number, default: 0 },
      },
      { _id: false }
    );

    // Main schema
    const schema = new Schema<IUserSubscriptionSnapshotDoc>(
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        plan: {
          type: Schema.Types.ObjectId,
          ref: "SubscriptionPlan",
          required: true,
        },
        status: {
          type: String,
          enum: ["pending", "active", "inactive", "cancelled", "expired"],
          default: "pending",
        },
        startedAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true },
        features: { type: [userAssignedFeatureSchema], required: false, default: undefined },
        transaction: {
          type: Schema.Types.ObjectId,
          ref: 'newTransaction',
          required: true,
        },
        autoRenew: {
          type: Boolean,
          default: false,
        },
        meta: {
          type: Schema.Types.Mixed,
          default: {},
        },
      },
      { timestamps: true }
    );

    this.userSubscriptionSnapshotModel = model<IUserSubscriptionSnapshotDoc>(
      "UserSubscriptionSnapshot",
      schema
    );
  }

  public get model(): IUserSubscriptionSnapshotModel {
    return this.userSubscriptionSnapshotModel;
  }
}
