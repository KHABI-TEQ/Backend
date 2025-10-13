import { Schema, model, Document, Model, Types } from "mongoose";

// ===== PROMOTION MODEL =====
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
  views: number;
  clicks: number;
  status: PromotionStatus;
  createdBy: Types.ObjectId;
}

export interface IPromotionDoc extends IPromotion, Document {
  createdAt: Date;
}
export type IPromotionModel = Model<IPromotionDoc>;

export class Promotion {
  private promotionModel: IPromotionModel;

  constructor() {
    const schema = new Schema<IPromotionDoc>(
      {
        title: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
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
        views: { type: Number, default: 0, min: 0 },
        clicks: { type: Number, default: 0, min: 0 },
        status: {
          type: String,
          enum: ["active", "inactive", "expired", "draft"],
          default: "draft",
        },
        createdBy: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
      },
      { timestamps: true }
    );

    // Indexes for efficient queries
    schema.index({ status: 1, type: 1 });
    schema.index({ isFeatured: 1, status: 1 });
    schema.index({ endDate: 1 });
    schema.index({ createdAt: -1 });

    // Auto-expire promotions based on endDate
    schema.pre("save", function (next) {
      const now = new Date();
      
      if (this.endDate && this.endDate < now && this.status === "active") {
        this.status = "expired";
      }
      
      // FIXED: Also check startDate
      if (this.startDate && this.startDate > now && this.status === "active") {
        this.status = "draft";
      }
      
      next();
    });

    // Virtual for CTR
    schema.virtual("clickThroughRate").get(function () {
      if (this.views === 0) return 0;
      return ((this.clicks / this.views) * 100).toFixed(2);
    });

    this.promotionModel = model<IPromotionDoc>("Promotion", schema);
  }

  public get model(): IPromotionModel {
    return this.promotionModel;
  }
}