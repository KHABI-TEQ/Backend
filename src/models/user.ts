import { Schema, model, Document, Model } from "mongoose";

export interface IUser { 
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  isAccountInRecovery: boolean;
  address?: {
    street?: string;
    state?: string;
    localGovtArea?: string;
  };
  fullName?: string;
  profile_picture?: string;
  isAccountVerified: boolean;
  isInActive: boolean;
  isDeleted: boolean;
  accountApproved: boolean;
  accountStatus: "active" | "inactive" | "deleted" | "flagged" | "pending_deletion";
  userType: "Landowners" | "Agent" | "FieldAgent";
  isFlagged: boolean;
  accountId: string;
  googleId?: string;
  facebookId?: string;
  enableNotifications?: boolean;
  referralCode?: string;
  referredBy?: string;
  deletionRequestedAt?: Date;
  deletionGracePeriodDays?: number;
}
 
export interface IUserDoc extends IUser, Document {
  createdAt: Date;
  updatedAt: Date;
}
 
export type IUserModel = Model<IUserDoc>;

export class User {
  private UserModel: Model<IUserDoc>;

  constructor() {
    const schema = new Schema(
      {
        email: { type: String, required: true, unique: true },
        password: { type: String },
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        phoneNumber: { type: String },
        address: {
          street: { type: String },
          state: { type: String },
          localGovtArea: { type: String },
        },
        isAccountInRecovery: { type: Boolean, default: false },
        profile_picture: { type: String },

        isInActive: { type: Boolean, default: false },
        isAccountVerified: { type: Boolean, default: false },
        isDeleted: { type: Boolean, default: false },
        accountApproved: { type: Boolean, default: false },
        accountStatus: { 
          type: String,
          enum: ["active", "inactive", "deleted", "flagged", "pending_deletion"],
          default: "active",
        },
        userType: {
          type: String,
          enum: ["Landowners", "Agent", "FieldAgent"],
          required: true,
        },
        isFlagged: { type: Boolean, default: false },
        accountId: { type: String, required: true, unique: true },

        googleId: { type: String, unique: true, sparse: true },
        facebookId: { type: String, unique: true, sparse: true },
        enableNotifications: { type: Boolean, default: true },
        referralCode: { type: String, unique: true, sparse: true },
        referredBy: { type: String },
        deletionRequestedAt: { type: Date },
        deletionGracePeriodDays: { type: Number, default: 7 },
      },
      {
        timestamps: true,
        toJSON: { 
          virtuals: true,
          transform(doc, ret) {
          delete ret.password;
          delete ret.__v;
          delete ret.googleId;
          delete ret.facebookId;
          delete ret.isDeleted;
          return ret;
      },
        },
        toObject: { 
          virtuals: true,
          transform(doc, ret) {
            delete ret.password;
            delete ret.__v;
            delete ret.googleId;
            delete ret.facebookId;
            delete ret.isDeleted;
            return ret;
          },
        },
      },
    );
    

    // Virtual for fullName
    schema.virtual("fullName").get(function (this: IUserDoc) {
      return `${this.firstName} ${this.lastName}`;
    });

    this.UserModel = model<IUserDoc>("User", schema);
  }

  public get model(): Model<IUserDoc> {
    return this.UserModel;
  }
}
