import { Schema, model, Document, Model } from 'mongoose';

export interface IAgent {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  isAccountInRecovery: boolean;
  address: {
    street: string;
    // city: string;
    state: string;
    localGovtArea: string;
  };
  fullName?: string;
  profile_picture: string;
  regionOfOperation: string[];
  agentType: string;
  companyAgent: {
    companyName?: string;
    // regNumber?: string;
  };
  individualAgent: {
    typeOfId: string;
    // idNumber: string;
  };
  isAccountVerified: boolean;
  isInActive?: boolean;
  isDeleted?: boolean;
  accountApproved?: boolean;
  accountStatus?: string;
  meansOfId: {
    name: string;
    docImg: string[];
  }[];
  isInUpgrade: boolean;
  upgradeData: {
    companyAgent: {
      companyName?: string;
      // regNumber?: string;
    };
    meansOfId: {
      name: string;
      docImg: string[];
    }[];
    requestDate?: Date;
    approvedDate?: Date;
  };
  isFlagged: boolean;
}

export interface IAgentDoc extends IAgent, Document {}

export type IAgentModel = Model<IAgentDoc>;

export class Agent {
  private AgentModel: Model<IAgentDoc>;

  constructor() {
    const schema = new Schema(
      {
        email: { type: String, required: true, unique: true },
        password: { type: String },
        firstName: { type: String },
        lastName: { type: String },
        phoneNumber: { type: String },
        fullName: { type: String },
        address: {
          street: { type: String },
          // city: { type: String },
          state: { type: String },
          localGovtArea: { type: String },
        },
        isAccountInRecovery: { type: Boolean, default: false },
        profile_picture: { type: String },
        regionOfOperation: { type: [String] },
        agentType: { type: String, enum: ['Individual', 'Company'] },
        companyAgent: {
          companyName: { type: String },
          // regNumber: { type: String },
        },
        individualAgent: {
          typeOfId: { type: String },
          // idNumber: { type: String },
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

        isInUpgrade: { type: Boolean, default: false },
        upgradeData: {
          companyAgent: {
            companyName: { type: String },
            // regNumber: { type: String },
          },
          meansOfId: [
            {
              name: { type: String },
              docImg: { type: [String] },
            },
          ],
          requestDate: { type: Date, default: Date.now },
          approvedDate: { type: Date },
        },
        isFlagged: { type: Boolean, default: false },
      },
      {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
      }
    );

    // schema.virtual('fullName').get(function (this: IAgentDoc) {
    //   return `${this.firstName} ${this.lastName}`;
    // });

    // schema.pre('updateOne', function (next) {
    //   const update = (this as any).getUpdate();

    //   // Check if `agentType` is being updated
    //   if (update && update.agentType) {
    //     if (update.agentType === 'individual') {
    //       // Ensure `individualAgent` is provided
    //       if (!update.individualAgent || !update.individualAgent.typeOfId || !update.individualAgent.idNumber) {
    //         return next(new Error('For individual agents, typeOfId and idNumber are required.'));
    //       }
    //       // Clear `companyAgent` if agent type is individual
    //       update.companyAgent = undefined;
    //     } else if (update.agentType === 'company') {
    //       // Ensure `companyAgent` is provided
    //       if (!update.companyAgent || !update.companyAgent.companyName || !update.companyAgent.regNUmber) {
    //         return next(new Error('For company agents, companyName and regNUmber are required.'));
    //       }
    //       // Clear `individualAgent` if agent type is company
    //       update.individualAgent = undefined;
    //     }
    //   }

    //   next();
    // });

    this.AgentModel = model<IAgentDoc>('Agent', schema);
  }

  public get model(): Model<IAgentDoc> {
    return this.AgentModel;
  }
}
