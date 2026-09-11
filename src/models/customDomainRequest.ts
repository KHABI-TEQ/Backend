import { Schema, model, models, Document, Model, Types } from "mongoose";

export type CustomDomainSiteKind = "deal-site" | "professional-site";

export type CustomDomainRequestStatus =
  | "draft"
  | "awaiting-payment"
  | "paid"
  | "forwarded-to-tech"
  | "live"
  | "rejected"
  | "cancelled";

export interface ICustomDomainRequest {
  ownerId: Types.ObjectId;
  siteKind: CustomDomainSiteKind;
  siteId: Types.ObjectId;
  preferredNames: string[];
  contactEmail: string;
  notes?: string;
  amount: number;
  transaction?: Types.ObjectId;
  subscriptionSnapshot?: Types.ObjectId;
  planCode?: string;
  billingInterval?: string;
  status: CustomDomainRequestStatus;
  assignedCustomDomain?: string;
  adminNote?: string;
  techNote?: string;
}

export interface ICustomDomainRequestDoc extends ICustomDomainRequest, Document {
  createdAt: Date;
  updatedAt: Date;
}

export type ICustomDomainRequestModel = Model<ICustomDomainRequestDoc>;

export class CustomDomainRequest {
  private _model: ICustomDomainRequestModel;

  constructor() {
    const schema = new Schema<ICustomDomainRequestDoc>(
      {
        ownerId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
          index: true,
        },
        siteKind: {
          type: String,
          enum: ["deal-site", "professional-site"],
          required: true,
          index: true,
        },
        siteId: {
          type: Schema.Types.ObjectId,
          required: true,
          index: true,
        },
        preferredNames: {
          type: [String],
          default: [],
        },
        contactEmail: { type: String, required: true, trim: true, lowercase: true },
        notes: { type: String, trim: true },
        amount: { type: Number, required: true, min: 0 },
        transaction: {
          type: Schema.Types.ObjectId,
          ref: "NewTransaction",
        },
        subscriptionSnapshot: {
          type: Schema.Types.ObjectId,
          ref: "UserSubscriptionSnapshot",
        },
        planCode: { type: String, trim: true, uppercase: true },
        billingInterval: { type: String, trim: true, lowercase: true },
        status: {
          type: String,
          enum: [
            "draft",
            "awaiting-payment",
            "paid",
            "forwarded-to-tech",
            "live",
            "rejected",
            "cancelled",
          ],
          default: "draft",
          index: true,
        },
        assignedCustomDomain: {
          type: String,
          trim: true,
          lowercase: true,
          index: true,
        },
        adminNote: { type: String, trim: true },
        techNote: { type: String, trim: true },
      },
      { timestamps: true }
    );

    schema.index({ ownerId: 1, siteKind: 1 });
    schema.index({ status: 1, updatedAt: -1 });

    this._model =
      (models.CustomDomainRequest as ICustomDomainRequestModel) ||
      model<ICustomDomainRequestDoc>("CustomDomainRequest", schema);
  }

  public get model(): ICustomDomainRequestModel {
    return this._model;
  }
}
