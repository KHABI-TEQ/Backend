import { Schema, model, Document, Model, Types } from "mongoose";

/**
 * Receiver Mode
 */
export interface IReceiverMode {
  type?: "general" | "dealSite";
  dealSiteID?: Types.ObjectId;
}

/**
 * Email Subscription fields
 */
export interface IEmailSubscription {
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  status: "subscribed" | "unsubscribed";
  receiverMode?: IReceiverMode;
}

/**
 * Mongoose timestamps
 */
export interface ITimestamps {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Document interface
 */
export interface IEmailSubscriptionDoc
  extends IEmailSubscription,
    ITimestamps,
    Document {}

export type IEmailSubscriptionModel = Model<IEmailSubscriptionDoc>;

export class EmailSubscription {
  private emailSubscriptionModel: IEmailSubscriptionModel;

  constructor() {
    const schema = new Schema<IEmailSubscriptionDoc>(
      {
        firstName: {
          type: String,
          default: null,
          trim: true,
        },
        lastName: {
          type: String,
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
          enum: ["subscribed", "unsubscribed"],
          default: "subscribed",
          required: true,
        },
        receiverMode: {
          type: {
            type: String,
            enum: ["general", "dealSite"],
            default: "general",
          },
          dealSiteID: {
            type: Schema.Types.ObjectId,
            ref: "DealSite",
          },
        },
      },
      {
        timestamps: true,
      }
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
