import { Schema, model, Model, models, Document, Types } from "mongoose";

export interface IPreference {
  buyer: Types.ObjectId;

  preferenceType: "buy" | "joint-venture" | "rent" | "shortlet";
  preferenceMode: "buy" | "tenant" | "developer" | "shortlet";

  location?: {
    state?: string;
    localGovernmentAreas?: string[];
    lgasWithAreas?: {
      lgaName: string;
      areas: string[];
    }[];
    customLocation?: string;
  };

  budgetMin?: number;
  budgetMax?: number;
  currency?: string;

  landSize?: number;
  measurementType?: string;

  documents?: string[];
  features?: string[];

  propertyDetails?: any; // For Buy & Rent
  developmentDetails?: any; // For JV
  bookingDetails?: any; // For Shortlet

  contactInfo?: any;

  nearbyLandmark?: string;
  additionalInfo?: string;

  assignedAgent?: Types.ObjectId;
  status: "pending" | "approved" | "matched" | "closed" | "rejected";

  createdAt: Date;
  updatedAt: Date;
}

export interface IPreferenceDoc extends IPreference, Document {}

export type IPreferenceModel = Model<IPreferenceDoc>;

export class Preference {
  private PreferenceModel: IPreferenceModel;

  constructor() {
    const schema = new Schema(
      {
        buyer: { type: Schema.Types.ObjectId, ref: "Buyer", required: true },

        preferenceType: {
          type: String,
          enum: ["buy", "joint-venture", "rent", "shortlet"],
          required: true,
        },

        preferenceMode: {
          type: String,
          enum: ["buy", "developer", "tenant", "shortlet"],
          required: true,
        },

        location: {
          state: String,
          localGovernmentAreas: [String],
          lgasWithAreas: [
            {
              lgaName: String,
              areas: [String],
            },
          ],
          customLocation: String,
        },

        budgetMin: Number,
        budgetMax: Number,
        currency: String,

        landSize: Number,
        measurementType: String,

        documents: [String],
        features: [String],

        propertyDetails: { type: Schema.Types.Mixed },
        developmentDetails: { type: Schema.Types.Mixed },
        bookingDetails: { type: Schema.Types.Mixed },

        contactInfo: { type: Schema.Types.Mixed },

        nearbyLandmark: String,
        additionalInfo: String,

        assignedAgent: { type: Schema.Types.ObjectId, ref: "Agent" },

        status: {
          type: String,
          enum: ["pending", "approved", "matched", "closed", "rejected"],
          default: "pending",
        },
      },
      { timestamps: true },
    );

    this.PreferenceModel =
      models.Preference || model<IPreferenceDoc>("Preference", schema);
  }

  public get model(): IPreferenceModel {
    return this.PreferenceModel;
  }
}
