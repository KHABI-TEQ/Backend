import { Schema, model, Document, Types } from "mongoose";

export const PROPERTY_VIEW_SOURCES = [
  "website",
  "buyers_app",
  "practitioner_page",
] as const;

export type PropertyViewSource = (typeof PROPERTY_VIEW_SOURCES)[number];

export interface IPropertyView extends Document {
  property: Types.ObjectId;
  owner: Types.ObjectId;
  pageOwner?: Types.ObjectId;
  viewer?: Types.ObjectId;
  ipAddress: string;
  userAgent?: string;
  source: PropertyViewSource;
  viewedAt: Date;
}

const PropertyViewSchema = new Schema<IPropertyView>(
  {
    property: { type: Schema.Types.ObjectId, ref: "Property", required: true, index: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    pageOwner: { type: Schema.Types.ObjectId, ref: "User", index: true },
    viewer: { type: Schema.Types.ObjectId },
    ipAddress: { type: String, required: true },
    userAgent: { type: String },
    source: {
      type: String,
      enum: PROPERTY_VIEW_SOURCES,
      default: "website",
      required: true,
    },
    viewedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

PropertyViewSchema.index({ property: 1, ipAddress: 1, viewedAt: -1 });
PropertyViewSchema.index({ property: 1, viewer: 1, viewedAt: -1 });
PropertyViewSchema.index({ owner: 1, viewedAt: -1 });
PropertyViewSchema.index({ pageOwner: 1, viewedAt: -1 });

export const PropertyView = model<IPropertyView>("PropertyView", PropertyViewSchema);
