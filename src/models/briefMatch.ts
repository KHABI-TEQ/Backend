import { Document, model, Types, Model, ObjectId, Schema } from 'mongoose';

export interface IBriefMatch{
  brief:Types.ObjectId;
  preference: Types.ObjectId;
  status: 'pending' | 'sent' | 'selected_by_buyer';
  privateLink?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBriefMatchDoc extends IBriefMatch, Document {}

export type IBriefMatchModel = Model<IBriefMatchDoc>;


export class BriefMatch {
  private BriefMatchModel: Model<IBriefMatchDoc>;

  constructor() {
    const schema = new Schema(
      {
        brief: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
        preference: { type: Schema.Types.ObjectId, ref: 'Preference', required: true },
        status: {
          type: String,
          enum: ['pending', 'sent', 'selected_by_buyer'],
          default: 'pending',
        },
        privateLink: { type: String }, // Used to email buyer
      },
      { timestamps: true }
    );

    this.BriefMatchModel = model<IBriefMatchDoc>('BriefMatch', schema);
  }

  public get model(): Model<IBriefMatchDoc> {
    return this.BriefMatchModel;
  }
}
