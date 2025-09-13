import { Schema, model, models, Document, Model, Types } from 'mongoose';

export interface IGuarantor {
  fullName?: string;
  phoneNumber?: string;
  relationship?: string;
  address?: string;
}

export interface IFieldAgent {
  whatsappNumber?: string;
  address?: {
    street?: string;
    homeNo?: string;
    state: string;
    localGovtArea: string;
  };
  govtId?: {
    typeOfId: 'national-id' | 'voter-card' | 'international-passport' | 'drivers-license';
    idNumber: string;
    docImg?: string[];
  };
  utilityBill?: {
    name: string;
    docImg?: string[];
  };
  regionOfOperation: string[];
  guarantors?: IGuarantor[];
  isFlagged: boolean;
  accountApproved?: boolean;
  assignedInspections?: string[];
  userId: Types.ObjectId;
}
 
export interface IFieldAgentDoc extends IFieldAgent, Document {}
export type IFieldAgentModel = Model<IFieldAgentDoc>;

export class FieldAgent {
  private FieldAgentModel: Model<IFieldAgentDoc>;

  constructor() {
    const schema = new Schema(
      {
        whatsappNumber: { type: String },
        address: {
          street: { type: String },
          homeNo: { type: String },
          state: { type: String },
          localGovtArea: { type: String },
        },
        govtId: {
          typeOfId: {
            type: String,
            enum: ['national-id', 'voter-card', 'international-passport', 'drivers-license']
          },
          idNumber: { type: String },
          docImg: { type: [String], default: [] }, // optional image(s)
        },
        utilityBill: {
          name: { type: String },
          docImg: { type: [String], default: [] }, // optional image(s)
        },
        regionOfOperation: { type: [String] },
        guarantors: [
          {
            fullName: { type: String },
            phoneNumber: { type: String },
            relationship: { type: String },
            address: { type: String },
          },
        ],
        isFlagged: { type: Boolean, default: false },
        accountApproved: { type: Boolean, default: false },
        assignedInspections: { type: [String] },
        userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
      },
      {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
      }
    );

    this.FieldAgentModel = (models.FieldAgent as Model<IFieldAgentDoc>) || model<IFieldAgentDoc>('FieldAgent', schema);
  }

  public get model(): Model<IFieldAgentDoc> {
    return this.FieldAgentModel;
  }
}
