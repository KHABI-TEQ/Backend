import { Schema, model, Document, Model, Types } from "mongoose";

export type ActivityType = "view" | "click";

export interface IPromotionActivity {
  promotionId: Types.ObjectId; // Reference to the promotion
  userId?: Types.ObjectId; // Optional (for logged-in users)
  ipAddress?: string; // Used to track anonymous uniqueness
  userAgent?: string; // Optional (can help detect bots or duplicates)
  type: ActivityType;
  createdAt?: Date;
}

export interface IPromotionActivityDoc extends IPromotionActivity, Document {}
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

    // Prevent multiple logs for the same promotion + user/ip + type in a short time window
    schema.index({ promotionId: 1, userId: 1, ipAddress: 1, type: 1 }, { unique: true });

    this.promotionActivityModel = model<IPromotionActivityDoc>(
      "PromotionActivity",
      schema
    );
  }

  public get model(): IPromotionActivityModel {
    return this.promotionActivityModel;
  }
}
