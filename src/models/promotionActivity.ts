import { Schema, model, Document, Model, Types } from "mongoose";

// ===== PROMOTION ACTIVITY MODEL =====
export type ActivityType = "view" | "click";

export interface IPromotionActivity {
  promotionId: Types.ObjectId;
  userId?: Types.ObjectId;
  ipAddress?: string;
  userAgent?: string;
  type: ActivityType;
  createdAt?: Date;
}
 
export interface IPromotionActivityDoc extends IPromotionActivity, Document {
  createdAt: Date;
}
export type IPromotionActivityModel = Model<IPromotionActivityDoc>;

export class PromotionActivity {
  private promotionActivityModel: IPromotionActivityModel;

  constructor() {
    const schema = new Schema<IPromotionActivityDoc>(
      {
        promotionId: {
          type: Schema.Types.ObjectId,
          ref: "Promotion",
          required: true,
          index: true,
        },
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: false,
        },
        ipAddress: { type: String, required: false },
        userAgent: { type: String, required: false },
        type: {
          type: String,
          enum: ["view", "click"],
          required: true,
        },
      },
      { timestamps: { createdAt: true, updatedAt: false } }
    );

    // FIXED: Compound index for efficient queries, but NOT unique
    // This allows multiple views/clicks over time
    schema.index({ promotionId: 1, type: 1, createdAt: -1 });
    schema.index({ userId: 1, promotionId: 1, type: 1 });
    
    // Optional: Add TTL index to auto-delete old activity logs after 90 days
    schema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

    this.promotionActivityModel = model<IPromotionActivityDoc>(
      "PromotionActivity",
      schema
    );
  }

  public get model(): IPromotionActivityModel {
    return this.promotionActivityModel;
  }
}
