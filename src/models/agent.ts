import { Schema, model, models, Document, Model, Types } from 'mongoose';

export interface IAgent {
  address: {
    street: string;
    homeNo: string;
    state: string;
    localGovtArea: string;
  };
  regionOfOperation: string[];
  agentType: string;
  companyAgent?: {
    companyName?: string;
    cacNumber?: string;
  };
  isInActive?: boolean;
  isDeleted?: boolean;
  accountApproved?: boolean;
  accountStatus?: string;
  meansOfId?: {
    name: string;
    docImg: string[];
  }[];
  isFlagged: boolean;
  userId:Types.ObjectId;
  govtId?: {
    typeOfId: string;
    idNumber: string;
  };
  inspectionSettings?: {
    inspectionPrice: number;
    inspectionPriceEnabled: boolean;
  };

  // NEW FIELDS
  agentLicenseNumber?: string;
  profileBio?: string;
  specializations?: string[]; // e.g., Luxury, Rentals, Shortlet, JV
  languagesSpoken?: string[]; // e.g., English, Yoruba, Igbo
  servicesOffered?: string[]; // e.g., Consultation, Market Analysis, Management
  achievements?: {
    title: string;
    description?: string;
    fileUrl?: string;
    dateAwarded?: Date;
  }[];
  featuredListings?: Types.ObjectId[]; // references to property IDs
}
 
export interface IAgentDoc extends IAgent, Document {}

export type IAgentModel = Model<IAgentDoc>;

export class Agent {
  private AgentModel: Model<IAgentDoc>;

  constructor() {
    const schema = new Schema(
      {
        address: {
          street: { type: String },
          state: { type: String },
          homeNo: { type: String },
          localGovtArea: { type: String },
        },
        regionOfOperation: { type: [String] },
        agentType: { type: String, enum: ['Individual', 'Company'] },
        companyAgent: {
          companyName: { type: String },
        },
        isAccountVerified: { type: Boolean, default: false },
        isInActive: { type: Boolean, default: false },
        isDeleted: { type: Boolean, default: false },
        accountApproved: { type: Boolean, default: false },
        accountStatus: { type: String, enum: ['active', 'inactive', 'deleted'], default: 'active' },
        meansOfId: [
          {
            name: { type: String },
            docImg: { type: [String] },
          },
        ],

        isFlagged: { type: Boolean, default: false },
        userId: { type:Schema.Types.ObjectId, required: true, ref: 'User' },
        govtId: {
          typeOfId: { type: String },
          idNumber: { type: String },
        },
        inspectionSettings: {
          inspectionPrice: { type: Number, default: 0 },
          inspectionPriceEnabled: { type: Boolean, default: false },
        },

        // NEW SCHEMA FIELDS
        agentLicenseNumber: { type: String },
        profileBio: { type: String },
        specializations: { type: [String], default: [] },
        languagesSpoken: { type: [String], default: [] },
        servicesOffered: { type: [String], default: [] },
        achievements: {
          type: [
            {
              title: { type: String, required: true },
              description: { type: String },
              fileUrl: { type: String },
              dateAwarded: { type: Date },
            },
          ],
          default: [],
        },
        featuredListings: [{ type: Schema.Types.ObjectId, ref: 'Property' }],
      },
      {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
      }
    );

    this.AgentModel = (models.Agent as Model<IAgentDoc>) || model<IAgentDoc>('Agent', schema);
  }

  public get model(): Model<IAgentDoc> {
    return this.AgentModel;
  }
}
