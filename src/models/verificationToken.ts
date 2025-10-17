import { Schema, model, Types, Document } from "mongoose";

export interface IVerificationToken extends Document {
  userId: Types.ObjectId;
  token: string;
  expiresAt: Date;
}

const verificationTokenSchema = new Schema<IVerificationToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export const VerificationToken = model<IVerificationToken>('verificationToken', verificationTokenSchema);
