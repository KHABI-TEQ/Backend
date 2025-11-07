import { Schema, model, Document, Model, Types } from "mongoose";

export interface IReceiverMode {
  type?: "general" | "dealSite";
  dealSiteID?: Types.ObjectId;
}

export interface IEmailSubscription {
  firstName?: string | null;  // nullable
  lastName?: string | null;   // nullable
  email: string;              // required
  status: "subscribed" | "unsubscribed";  // required
  receiverMode?: IReceiverMode; // NEW FIELD
}

export interface IEmailSubscriptionDoc extends IEmailSubscription, Document {}

export type IEmailSubscriptionModel = Model<IEmailSubscriptionDoc>;

export class EmailSubscription {
  private emailSubscriptionModel: IEmailSubscriptionModel;

  constructor() {
    const schema = new Schema<IEmailSubscriptionDoc>(
      {
        firstName: {
          type: String,
          required: false,
          default: null,
          trim: true,
        },
        lastName: {
          type: String,
          required: false,
          default: null,
          trim: true,
        },
        email: {
          type: String,
          required: true,
          unique: true,
          lowercase: true,
          trim: true,
        },
        status: {
          type: String,
          required: true,
          enum: ["subscribed", "unsubscribed"],
          default: "subscribed",
        },
        receiverMode: {
          type: {
            type: String,
            enum: ["general", "dealSite"],
            default: "general",
          },
          dealSiteID: { type: Schema.Types.ObjectId, ref: "DealSite" },
        },
      },
      { timestamps: true }
    );

    this.emailSubscriptionModel = model<IEmailSubscriptionDoc>(
      "EmailSubscription",
      schema
    );
  }

  public get model(): IEmailSubscriptionModel {
    return this.emailSubscriptionModel;
  }
}
