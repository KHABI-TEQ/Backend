import { Schema, model, Document, Model, Types } from 'mongoose';

export type SubscriptionStatus = 'pending' | 'active' | 'inactive' | 'cancelled' | 'expired';

export interface ISubscription {
  user: Types.ObjectId;
  plan: string;
  status: SubscriptionStatus;
  startDate: Date;
  endDate: Date;
  transaction: Types.ObjectId;
  autoRenew?: boolean;
}
 
export interface ISubscriptionDoc extends ISubscription, Document {}

export type ISubscriptionModel = Model<ISubscriptionDoc>;

export class Subscription {
  private subscriptionModel: ISubscriptionModel;

  constructor() {
    const schema = new Schema<ISubscriptionDoc>(
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        plan: {
          type: String,
          required: true,
        },
        status: {
          type: String,
          enum: ['pending', 'active', 'inactive', 'cancelled', 'expired'],
          default: 'pending',
        },
        startDate: {
          type: Date,
          required: true,
        },
        endDate: {
          type: Date,
          required: true,
        },
        transaction: {
          type: Schema.Types.ObjectId,
          ref: 'NewTransaction',
          required: true,
        },
        autoRenew: {
          type: Boolean,
          default: false,
        },
      },
      { timestamps: true }
    );

    this.subscriptionModel = model<ISubscriptionDoc>('Subscription', schema);
  }

  public get model(): ISubscriptionModel {
    return this.subscriptionModel;
  }
}
