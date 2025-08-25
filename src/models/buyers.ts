import { Schema, model, Document, Model } from 'mongoose';

export interface IBuyer {
  fullName: string;
  phoneNumber: string;
  email: string;
  companyName?: string;
  address?: string;
  contactPerson?: string;
  cacRegistrationNumber?: string;
  whatsAppNumber?: string;
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
        companyName: { type: String },
        address: { type: String },
        contactPerson: { type: String },
        cacRegistrationNumber: { type: String },
        whatsAppNumber: { type: String }
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
