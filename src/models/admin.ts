import { Schema, model, Document, Model } from 'mongoose';
  
export interface IAdmin {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  isAccountInRecovery: boolean;
  address?: {
    street?: string;
    state?: string;
    localGovtArea?: string;
  };
  fullName?: string;
  profile_picture: string;
  roles?: string[]; // Array of Role IDs (supports multiple roles)
  permissions?: string[]; // Direct permissions (for flexibility)
  isVerified: boolean;
  isAccountVerified: boolean;
  isActive: boolean;
  lastLogin?: Date;
  loginAttempts: number;
  lockoutUntil?: Date;
} 

export interface IAdminDoc extends IAdmin, Document {}

export type IAdminModel = Model<IAdminDoc>;

export class Admin {
  private AdminModel: Model<IAdminDoc>;

  constructor() {
    const schema = new Schema(
      {
        email: { type: String, required: true, unique: true, lowercase: true },
        password: { type: String },
        firstName: { type: String },
        lastName: { type: String },
        phoneNumber: { type: String },
        fullName: { type: String },
        address: {
          street: { type: String },
          state: { type: String },
          localGovtArea: { type: String },
        },
        isAccountInRecovery: { type: Boolean, default: false },
        profile_picture: { type: String },
        isAccountVerified: { type: Boolean, default: false },
        isVerified: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },
        roles: [
          {
            type: Schema.Types.ObjectId,
            ref: 'Role',
            required: false,
          },
        ],
        permissions: [
          {
            type: Schema.Types.ObjectId,
            ref: 'Permission',
            required: false,
          },
        ],
        lastLogin: { type: Date },
        loginAttempts: { type: Number, default: 0 },
        lockoutUntil: { type: Date },
      },
      {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
      }
    );

    // Index for faster queries
    schema.index({ email: 1 });
    schema.index({ isActive: 1 });
    schema.index({ role: 1 });

    this.AdminModel = model<IAdminDoc>('Admin', schema);
  }

  public get model(): Model<IAdminDoc> {
    return this.AdminModel;
  }
}
