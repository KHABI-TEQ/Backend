import { Schema, model, Types, Document } from 'mongoose';

export interface IPasswordResetToken extends Document {
  userId: Types.ObjectId;
  userModel: 'User' | 'Admin';
  token: string;
  expiresAt: Date;
}

const passwordResetTokenSchema = new Schema<IPasswordResetToken>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, refPath: 'userModel' },
    userModel: { type: String, required: true, enum: ['User', 'Admin'] },
    token: { type: String, required: true }, // 6-digit token
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);


export const PasswordResetToken = model<IPasswordResetToken>('PasswordResetToken', passwordResetTokenSchema);
