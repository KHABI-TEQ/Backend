import { Schema, model, Document, Types } from "mongoose";

export interface IPropertyView extends Document {
  property: Types.ObjectId;
  ipAddress: string;
  viewedAt: Date;
}

const PropertyViewSchema = new Schema<IPropertyView>(
  {
    property: { type: Schema.Types.ObjectId, ref: "Property", required: true },
    ipAddress: { type: String, required: true },
    viewedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Optional: prevent multiple views per IP per property in 24 hours
PropertyViewSchema.index({ property: 1, ipAddress: 1, viewedAt: 1 });

export const PropertyView = model<IPropertyView>("PropertyView", PropertyViewSchema);
