import { Schema, model, Document, Model } from 'mongoose';

export interface IUser {
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

  isAccountVerified: boolean;
  isInActive?: boolean;
  isDeleted?: boolean;
  accountApproved?: boolean;
  accountStatus?: string;
  userType: string;
  isFlagged: boolean;
  accountId: string;
}

export interface IUserDoc extends IUser, Document {}

export type IUserModel = Model<IUserDoc>;

export class User {
  private UserModel: Model<IUserDoc>;

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
        isInActive: { type: Boolean, default: false },
        accountApproved: { type: Boolean, default: false },
        accountStatus: { type: String, enum: ['active', 'inactive', 'deleted'], default: 'active' },
        isFlagged: { type: Boolean, default: false },
        userType: { type: String, enum: ['Landowners', 'Agent'] },
        accountId: { type: String },
      },
      {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
      }
    );

    this.UserModel = model<IUserDoc>('User', schema);
  }

  public get model(): Model<IUserDoc> {
    return this.UserModel;
  }
}
