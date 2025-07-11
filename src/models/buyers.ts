import { Schema, model, Document, Model } from 'mongoose';

export interface IBuyer {
  fullName: string;
  phoneNumber: string;
  email: string;
}

export interface IBuyerDoc extends IBuyer, Document {}

export type IBuyerModel = Model<IBuyerDoc>;

export class Buyer {
  private generalModel: Model<IBuyerDoc>;

  constructor() {
    const schema = new Schema(
      {
        fullName: { type: String, required: true },
        email: { type: String, required: true },
        phoneNumber: { type: String, required: true },
      },
      {
        timestamps: true,
      }
    );

    this.generalModel = model<IBuyerDoc>('Buyer', schema);
  }

  public get model(): Model<IBuyerDoc> {
    return this.generalModel;
  }
}
