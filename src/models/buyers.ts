import { Schema, model, Document, Model } from 'mongoose';

export interface IBuyerDevice {
  deviceId: string;
  fcmToken: string;
  platform?: string;
  updatedAt?: Date;
}

export interface IBuyer {
  fullName: string;
  phoneNumber: string;
  email: string;
  password?: string;
  companyName?: string;
  address?: string;
  contactPerson?: string;
  cacRegistrationNumber?: string;
  whatsAppNumber?: string;
  devices?: IBuyerDevice[];
  enableNotifications?: boolean;
  profilePicture?: string;
}

export interface IBuyerDoc extends IBuyer, Document {}

export type IBuyerModel = Model<IBuyerDoc>;

export class Buyer {
  private generalModel: Model<IBuyerDoc>;

  constructor() {
    const deviceSchema = new Schema(
      {
        deviceId: { type: String, required: true },
        fcmToken: { type: String, required: true },
        platform: { type: String },
        updatedAt: { type: Date, default: Date.now },
      },
      { _id: false }
    );

    const schema = new Schema(
      {
        fullName: { type: String, required: true },
        email: { type: String, required: true, lowercase: true, trim: true },
        phoneNumber: { type: String, required: true },
        password: { type: String },
        companyName: { type: String },
        address: { type: String },
        contactPerson: { type: String },
        cacRegistrationNumber: { type: String },
        whatsAppNumber: { type: String },
        devices: { type: [deviceSchema], default: [] },
        enableNotifications: { type: Boolean, default: true },
        profilePicture: { type: String, default: "" },
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
