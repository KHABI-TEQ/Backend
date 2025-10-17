import { Schema, model, Document, Model, Types } from "mongoose";

export type ActivityActorModel = "User" | "Admin";
export type DealSiteActivityCategory =
  | "page-visit"
  | "product-view"
  | "product-added"
  | "product-updated"
  | "product-deleted"
  | "banner-updated"
  | "deal-onHold"
  | "deal-paused"
  | "deal-resumed"
  | "deal-setUp"
  | "deal-published"
  | "deal-unpublished"
  | "settings-updated"
  | "analytics-viewed"
  | "other";

export interface IDealSiteActivity {
  dealSite: Types.ObjectId; // reference to the DealSite
  actor: Types.ObjectId; // the user/admin performing action
  actorModel: ActivityActorModel; // whether user or admin
  category: DealSiteActivityCategory; // what kind of activity
  action: string; // short action name e.g. "Updated product", "Viewed analytics"
  description?: string; // detailed message (optional)
  ipAddress?: string; // to track user IP
  userAgent?: string; // to know device/browser
  metadata?: Record<string, any>; // extra contextual info
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IDealSiteActivityDoc extends IDealSiteActivity, Document {}
export type IDealSiteActivityModel = Model<IDealSiteActivityDoc>;

export class DealSiteActivity {
  private dealSiteActivityModel: IDealSiteActivityModel;

  constructor() {
    const schema = new Schema<IDealSiteActivityDoc>(
      {
        dealSite: { type: Schema.Types.ObjectId, ref: "DealSite", required: true },
        actor: {
          type: Schema.Types.ObjectId,
          refPath: "actorModel",
          required: true,
        },
        actorModel: {
          type: String,
          enum: ["User", "Admin"],
          required: true,
        },
        category: {
          type: String,
          enum: [
            "page-visit",
            "product-view",
            "product-added",
            "product-updated",
            "product-deleted",
            "banner-updated",
            "deal-onHold",
            "deal-paused",
            "deal-resumed",
            "deal-setUp",
            "deal-published",
            "deal-unpublished",
            "settings-updated",
            "analytics-viewed",
            "other",
          ],
          required: true,
        },
        action: { type: String, required: true },
        description: { type: String },
        ipAddress: { type: String },
        userAgent: { type: String },
        metadata: { type: Schema.Types.Mixed },
      },
      { timestamps: true }
    );

    this.dealSiteActivityModel = model<IDealSiteActivityDoc>(
      "DealSiteActivity",
      schema
    );
  }

  public get model(): IDealSiteActivityModel {
    return this.dealSiteActivityModel;
  }
}
