import { Schema, model, Document, Model, Types } from "mongoose";

export type PromotionStatus = "active" | "inactive" | "expired" | "draft";
export type PromotionType = "banner" | "sidebar" | "popup" | "carousel" | "inline";

export interface IPromotion {
  title: string;
  description?: string;
  imageUrl: string;
  redirectUrl?: string;
  type: PromotionType;
  startDate?: Date;
  endDate?: Date;
  isFeatured?: boolean;
  tags?: string[];

  // Metrics
  views: number;
  clicks: number;

  status: PromotionStatus;
  createdBy: Types.ObjectId;
}

export interface IPromotionDoc extends IPromotion, Document {}
export type IPromotionModel = Model<IPromotionDoc>;

export class Promotion {
  private promotionModel: IPromotionModel;

  constructor() {
    const schema = new Schema<IPromotionDoc>(
      {
        title: { type: String, required: true },
        description: { type: String },
        imageUrl: { type: String, required: true },
        redirectUrl: { type: String },
        type: {
          type: String,
          enum: ["banner", "sidebar", "popup", "carousel", "inline"],
          default: "banner",
        },
        startDate: { type: Date },
        endDate: { type: Date },
        isFeatured: { type: Boolean, default: false },
        tags: { type: [String], default: [] },

        // Metrics
        views: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 },

        status: {
          type: String,
          enum: ["active", "inactive", "expired", "draft"],
          default: "active",
        },
        createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
      },
      { timestamps: true }
    );

    // Auto-expire promotions based on endDate
    schema.pre("save", function (next) {
      if (this.endDate && this.endDate < new Date()) {
        this.status = "expired";
      }
      next();
    });

    this.promotionModel = model<IPromotionDoc>("Promotion", schema);
  }

  public get model(): IPromotionModel {
    return this.promotionModel;
  }
}
