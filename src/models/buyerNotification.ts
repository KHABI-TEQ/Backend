import { Schema, model, Document, Model, Types } from "mongoose";

export type BuyerNotificationType =
  | "general"
  | "preference"
  | "inspection"
  | "document"
  | "transaction"
  | "auth"
  | "email";

export interface IBuyerNotification {
  buyer: Types.ObjectId;
  title: string;
  message: string;
  isRead: boolean;
  type: BuyerNotificationType;
  /** Original email subject when mirrored from outbound mail. */
  emailSubject?: string;
  meta?: Record<string, unknown>;
}

export interface IBuyerNotificationDoc extends IBuyerNotification, Document {
  createdAt: Date;
  updatedAt: Date;
}

export type IBuyerNotificationModel = Model<IBuyerNotificationDoc>;

const TYPES: BuyerNotificationType[] = [
  "general",
  "preference",
  "inspection",
  "document",
  "transaction",
  "auth",
  "email",
];

const schema = new Schema<IBuyerNotificationDoc>(
  {
    buyer: {
      type: Schema.Types.ObjectId,
      ref: "Buyer",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    isRead: { type: Boolean, default: false, index: true },
    type: {
      type: String,
      enum: TYPES,
      default: "email",
    },
    emailSubject: { type: String },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

schema.index({ buyer: 1, createdAt: -1 });
schema.index({ buyer: 1, isRead: 1 });

export const BuyerNotification = model<IBuyerNotificationDoc>(
  "BuyerNotification",
  schema
);
