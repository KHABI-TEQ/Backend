import { Schema, model, Model, models, Document, Types } from 'mongoose';

export interface IPreference {
  buyer: Types.ObjectId;
  propertyType?: string;
  propertyCondition?: string;
  preferenceType: 'buy' | 'joint-venture' | 'rent' | 'shortlet';
  preferenceMode: 'buy' | 'tenant' | 'developer' | 'shortlet';
  location?: {
    state?: string;
    localGovernments?: string[];
    areas?: {
      name: string;
      lga: string;
    }[];
  };
  measurementType?: string;
  landSize?: number;
  budgetMin?: number;
  budgetMax?: number;
  documents?: string[];
  noOfBedrooms?: number;
  noOfBathrooms?: number;
  features?: string[];
  additionalInfo?: string;
  assignedAgent?: Types.ObjectId;
  status: 'pending' | 'approved' | 'matched' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

export interface IPreferenceDoc extends IPreference, Document {}

export type IPreferenceModel = Model<IPreferenceDoc>;

export class Preference {
  private PreferenceModel: Model<IPreferenceDoc>;

  constructor() {
    const schema = new Schema(
      {
        buyer: { type: Schema.Types.ObjectId, ref: 'Buyer' },

        propertyType: { type: String },
        propertyCondition: { type: String },

        preferenceType: {
          type: String,
          enum: ['buy', 'joint-venture', 'rent', 'shortlet'],
          required: true,
        },

        preferenceMode: {
          type: String,
          enum: ['buy', 'developer', 'tenant', 'shortlet'],
          required: true,
        },

        location: {
          state: { type: String },
          localGovernments: [{ type: String }],
          areas: [
            {
              name: { type: String },
              lga: { type: String },
            },
          ],
        },

        measurementType: { type: String },
        landSize: { type: Number },

        budgetMin: { type: Number },
        budgetMax: { type: Number },

        documents: [{ type: String }],

        noOfBedrooms: { type: Number },
        noOfBathrooms: { type: Number },

        features: [{ type: String }],
        additionalInfo: { type: String },

        assignedAgent: { type: Schema.Types.ObjectId, ref: 'Agent' },

        status: {
          type: String,
          enum: ['pending', 'approved', 'matched', 'closed'],
          default: 'pending',
        },
      },
      { timestamps: true }
    );

    this.PreferenceModel = models.Preference || model<IPreferenceDoc>('Preference', schema);
  }

   public get model(): Model<IPreferenceDoc> {
    return this.PreferenceModel;
  }
}
