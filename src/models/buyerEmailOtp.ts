import { Schema, model, Document } from "mongoose";

export interface IBuyerEmailOtp extends Document {
  email: string;
  token: string;
  expiresAt: Date;
  purpose: "login";
}

const buyerEmailOtpSchema = new Schema<IBuyerEmailOtp>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    purpose: { type: String, enum: ["login"], default: "login" },
  },
  { timestamps: true }
);

buyerEmailOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const BuyerEmailOtp = model<IBuyerEmailOtp>(
  "BuyerEmailOtp",
  buyerEmailOtpSchema
);
