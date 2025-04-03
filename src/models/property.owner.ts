import { Schema, model, Document, Model } from 'mongoose';
import { propertyOwner } from '../common/constants';

export interface IOwner {
  fullName: string;
  phoneNumber: string;
  email: string;
  ownerType: string;
}

export interface IOwnerDoc extends IOwner, Document {}

export type IOwnerModel = Model<IOwnerDoc>;

export class Owner {
  private ownerModel: Model<IOwnerDoc>;

  constructor() {
    const schema = new Schema(
      {
        fullName: { type: String, required: true },
        email: { type: String, required: true },
        phoneNumber: { type: String, required: true },
        ownerType: { type: String, required: true, enum: Object.values(propertyOwner.getOwnerType) },
      },
      {
        timestamps: true,
      }
    );

    this.ownerModel = model<IOwnerDoc>('PropertyOwner', schema);
  }

  public get model(): Model<IOwnerDoc> {
    return this.ownerModel;
  }
}
