import { Schema, model, models, Document, Types, Model } from "mongoose";

export interface IMatchedPreferenceProperty {
  preference: Types.ObjectId; // Reference to the buyer's preference
  buyer: Types.ObjectId; // The buyer ID
  matchedProperties: Types.ObjectId[]; // Array of matched property IDs
  status: "pending" | "notified" | "interested" | "closed" | "inspection-requested"; // Status of this match set
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMatchedPreferencePropertyDoc
  extends IMatchedPreferenceProperty,
    Document {}

export type IMatchedPreferencePropertyModel =
  Model<IMatchedPreferencePropertyDoc>;

const MatchedPreferencePropertySchema =
  new Schema<IMatchedPreferencePropertyDoc>(
    {
      preference: {
        type: Schema.Types.ObjectId,
        ref: "Preference",
        required: true,
      },
      buyer: { type: Schema.Types.ObjectId, ref: "User", required: true },
      matchedProperties: [
        { type: Schema.Types.ObjectId, ref: "Property", required: true },
      ],
      status: {
        type: String,
        enum: ["pending", "notified", "interested", "closed", "inspection-requested"],
        default: "pending",
      },
      notes: { type: String },
    },
    { timestamps: true },
  );

export const MatchedPreferenceProperty: IMatchedPreferencePropertyModel =
  models.MatchedPreferenceProperty ||
  model<IMatchedPreferencePropertyDoc>(
    "MatchedPreferenceProperty",
    MatchedPreferencePropertySchema,
  );
