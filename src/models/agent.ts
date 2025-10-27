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
  meansOfId?: {
    name: string;
    docImg: string[];
  }[];
  userId:Types.ObjectId;
  govtId?: {
    typeOfId: string;
    idNumber: string;
  };
  kycData?: {
    agentLicenseNumber?: string;
    profileBio?: string;
    specializations?: string[];
    languagesSpoken?: string[];
    servicesOffered?: string[];
    achievements?: {
      title: string;
      description?: string;
      fileUrl?: string;
      dateAwarded?: Date;
    }[];
  };
  kycNote?: string;
  kycStatus?: 'none' | 'pending' | 'in_review' | 'approved' | 'rejected';
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
        meansOfId: [
          {
            name: { type: String },
            docImg: { type: [String] },
          },
        ],
        userId: { type:Schema.Types.ObjectId, required: true, ref: 'User' },
        govtId: {
          typeOfId: { type: String },
          idNumber: { type: String },
        },
        kycData: {
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
        },
        kycNote: { type: String, trim: true },
        kycStatus: {
          type: String,
          enum: ['none', 'pending', 'in_review', 'approved', 'rejected'],
          default: 'none',
        },
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
