import { Schema, model, models, Document, Model, Types } from "mongoose";

export type TransactionCertificateAuditAction =
  | "CERTIFICATE_CREATED"
  | "CERTIFICATE_UPDATED"
  | "CERTIFICATE_DOWNLOADED"
  | "CERTIFICATE_VERIFIED"
  | "CERTIFICATE_CANCELLED"
  | "CERTIFICATE_REISSUED"
  | "TRANSACTION_EVENT_ADDED"
  | "TRANSACTION_EVENT_CORRECTED"
  | "TRANSACTION_REGISTERED"
  | "CERTIFICATE_ISSUED";

export interface ITransactionRegistrationActivityLog {
  registrationId: Types.ObjectId;
  transactionReference?: string;
  actorType: "User" | "Buyer" | "Admin" | "System" | "BRM";
  actorId?: Types.ObjectId;
  actorLabel?: string;
  action: TransactionCertificateAuditAction;
  previousValue?: unknown;
  nextValue?: unknown;
  reason?: string;
  meta?: Record<string, unknown>;
}

export interface ITransactionRegistrationActivityLogDoc
  extends ITransactionRegistrationActivityLog,
    Document {
  createdAt: Date;
  updatedAt: Date;
}

export type ITransactionRegistrationActivityLogModel =
  Model<ITransactionRegistrationActivityLogDoc>;

const schema = new Schema<ITransactionRegistrationActivityLogDoc>(
  {
    registrationId: {
      type: Schema.Types.ObjectId,
      ref: "TransactionRegistration",
      required: true,
      index: true,
    },
    transactionReference: { type: String, required: false, index: true },
    actorType: {
      type: String,
      enum: ["User", "Buyer", "Admin", "System", "BRM"],
      required: true,
    },
    actorId: { type: Schema.Types.ObjectId, required: false },
    actorLabel: { type: String, required: false },
    action: { type: String, required: true },
    previousValue: { type: Schema.Types.Mixed, required: false },
    nextValue: { type: Schema.Types.Mixed, required: false },
    reason: { type: String, required: false },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const TransactionRegistrationActivityLogModel =
  models.TransactionRegistrationActivityLog ||
  model<ITransactionRegistrationActivityLogDoc>(
    "TransactionRegistrationActivityLog",
    schema
  );
