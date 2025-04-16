import { Schema, model, Document, Model } from 'mongoose';

export interface IAdmin {
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
  role: string;
}

export interface IAdminDoc extends IAdmin, Document {}

export type IAdminModel = Model<IAdminDoc>;

export class Admin {
  private AdminModel: Model<IAdminDoc>;

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

        isAccountVerified: { type: Boolean, default: false },
        role: { type: String, enum: ['superAdmin', 'admin'], default: 'admin' },
      },
      {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
      }
    );

    this.AdminModel = model<IAdminDoc>('Admin', schema);
  }

  public get model(): Model<IAdminDoc> {
    return this.AdminModel;
  }
}
