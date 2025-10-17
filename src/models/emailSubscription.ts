import { Schema, model, Document, Model } from "mongoose";

export interface IEmailSubscription {
  firstName?: string | null;  // nullable
  lastName?: string | null;   // nullable
  email: string;              // required
  status: string;             // required (e.g., "subscribed", "unsubscribed")
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
          enum: ["subscribed", "unsubscribed"], // you can extend if needed
          default: "subscribed",
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
