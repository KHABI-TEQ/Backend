import { model, Model, Schema, Types, Document } from "mongoose";

export type AdminNotificationType =
  | "kyc_submitted"
  | "document_verification_submitted"
  | "transaction_registration_submitted"
  | "transaction_registration_fee_paid"
  | "agent_report_submitted"
  | "syndication_application_submitted"
  | "dealsite_reported"
  | "field_agent_representation_pending"
  | "general";

export interface IAdminNotification {
  admin: Types.ObjectId;
  title: string;
  message: string;
  isRead: boolean;
  type: AdminNotificationType;
  meta?: Record<string, unknown>;
}

export interface IAdminNotificationDoc extends IAdminNotification, Document {}

export type IAdminNotificationModel = Model<IAdminNotificationDoc>;

const TYPE_ENUM: AdminNotificationType[] = [
  "kyc_submitted",
  "document_verification_submitted",
  "transaction_registration_submitted",
  "transaction_registration_fee_paid",
  "agent_report_submitted",
  "syndication_application_submitted",
  "dealsite_reported",
  "field_agent_representation_pending",
  "general",
];

export class AdminNotification {
  private AdminNotificationModel: IAdminNotificationModel;

  constructor() {
    const schema = new Schema<IAdminNotificationDoc>(
      {
        admin: {
          type: Schema.Types.ObjectId,
          required: true,
          ref: "Admin",
          index: true,
        },
        title: { type: String, required: true, trim: true },
        message: { type: String, required: true, trim: true },
        isRead: { type: Boolean, default: false, index: true },
        type: {
          type: String,
          enum: TYPE_ENUM,
          default: "general",
          index: true,
        },
        meta: { type: Schema.Types.Mixed, default: {} },
      },
      { timestamps: true }
    );

    schema.index({ admin: 1, createdAt: -1 });
    schema.index({ admin: 1, isRead: 1 });

    this.AdminNotificationModel = model<IAdminNotificationDoc>(
      "AdminNotification",
      schema
    );
  }

  public get model(): IAdminNotificationModel {
    return this.AdminNotificationModel;
  }
}
