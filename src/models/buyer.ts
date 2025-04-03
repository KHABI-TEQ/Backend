import { Schema, model, Document, Model } from 'mongoose';
import { propertyOwner } from '../common/constants';

export interface IBuyerOrRent {
  fullName: string;
  phoneNumber: string;
  email: string;
  ownerType: string;
}

export interface IBuyerOrRentDoc extends IBuyerOrRent, Document {}

export type IBuyerOrRentModel = Model<IBuyerOrRentDoc>;

export class BuyerOrRent {
  private generalModel: Model<IBuyerOrRentDoc>;

  constructor() {
    const schema = new Schema(
      {
        fullName: { type: String, required: true },
        email: { type: String, required: true },
        phoneNumber: { type: String, required: true },
        ownerType: { type: String, required: true, enum: ['Buyer', 'Rent'] },
      },
      {
        timestamps: true,
      }
    );

    this.generalModel = model<IBuyerOrRentDoc>('BuyerOrRenter', schema);
  }

  public get model(): Model<IBuyerOrRentDoc> {
    return this.generalModel;
  }
}
