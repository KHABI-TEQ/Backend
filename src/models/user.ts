import { Schema, model, Document, Model } from 'mongoose';

export interface IUser {
  email: string;
  password?: string; // Optional for social logins
  firstName: string;
  lastName: string;
  phoneNumber?: string; // Optional
  isAccountInRecovery: boolean;
  address?: { // Optional as it might be added later
    street?: string;
    state?: string;
    localGovtArea?: string;
  };
  fullName?: string; // Virtual, or can be stored
  profile_picture?: string; // Optional

  isAccountVerified: boolean;
  isInActive: boolean;
  isDeleted: boolean;
  accountApproved: boolean; // For Agents
  accountStatus: 'active' | 'inactive' | 'deleted'; // Use string literal union
  userType: 'Landowners' | 'Agent'; // Use string literal union
  isFlagged: boolean;
  accountId: string; // Unique identifier for the account
  googleId?: string; // For Google OAuth
  facebookId?: string; // For Facebook OAuth
}

export interface IUserDoc extends IUser, Document {}

export type IUserModel = Model<IUserDoc>;

export class User {
  private UserModel: Model<IUserDoc>;

  constructor() {
    const schema = new Schema(
      {
        email: { type: String, required: true, unique: true },
        password: { type: String }, // Optional for social logins
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        phoneNumber: { type: String },
        // fullName: { type: String }, // Can be a virtual
        address: {
          street: { type: String },
          state: { type: String },
          localGovtArea: { type: String },
        },
        isAccountInRecovery: { type: Boolean, default: false },
        profile_picture: { type: String },

        isAccountVerified: { type: Boolean, default: false }, // Replaces emailVerified
        isInActive: { type: Boolean, default: false },
        isDeleted: { type: Boolean, default: false },
        accountApproved: { type: Boolean, default: false }, // Specific for agents
        accountStatus: { type: String, enum: ['active', 'inactive', 'deleted'], default: 'active' },
        userType: { type: String, enum: ['Landowners', 'Agent'], required: true },
        isFlagged: { type: Boolean, default: false },
        accountId: { type: String, required: true, unique: true }, // Ensure unique account ID

        googleId: { type: String, unique: true, sparse: true }, // For Google OAuth
        facebookId: { type: String, unique: true, sparse: true }, // For Facebook OAuth
      },
      {
        timestamps: true, // Adds createdAt and updatedAt
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
      }
    );

    // Virtual for fullName
    schema.virtual('fullName').get(function(this: IUserDoc) {
      return `${this.firstName} ${this.lastName}`;
    });

    this.UserModel = model<IUserDoc>('User', schema);
  }

  public get model(): Model<IUserDoc> {
    return this.UserModel;
  }
}
