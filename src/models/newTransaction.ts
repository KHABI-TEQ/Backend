import {
  Schema,
  model,
  Document,
  Model,
  ObjectId,
  Types,
} from 'mongoose';
 
export type TransactionType =
  | 'payment'
  | 'withdrawal'
  | 'deposit'
  | 'transfer'
  | 'refund'
  | 'subscription'
  | 'inspection'
  | 'shortlet-booking'
  | 'document-verification';

export interface INewTransaction {
  reference: string;
  fromWho: {
    kind: 'User' | 'Buyer';
    item: ObjectId;
  };
  amount: number;
  currency?: string;
  status?: 'pending' | 'success' | 'failed' | 'cancelled';
  transactionType: TransactionType;
  paymentMode?: string;
  paymentDetails?: Record<string, any>;
  platform?: string;
  meta?: Record<string, any>;
  transactionFlow?: 'internal' | 'external';
} 

export interface INewTransactionDoc extends INewTransaction, Document {}

export type INewTransactionModel = Model<INewTransactionDoc>;

export class NewTransaction {
  private newTransactionModel: INewTransactionModel;

  constructor() {
    const schema = new Schema<INewTransactionDoc>(
      {
        reference: {
          type: String,
          required: true,
          unique: true,
        },
        fromWho: {
          kind: {
            type: String,
            enum: ['User', 'Buyer'],
            required: true,
          },
          item: {
            type: Schema.Types.ObjectId,
            required: true,
            refPath: 'fromWho.kind',
          },
        },
        amount: {
          type: Number,
          required: true,
        },
        currency: {
          type: String,
          default: 'NGN',
        },
        status: {
          type: String,
          enum: ['pending', 'success', 'failed', 'cancelled'],
          default: 'pending',
        },
        transactionType: {
          type: String,
          enum: [
            'payment',
            'withdrawal',
            'deposit',
            'transfer',
            'refund',
            'subscription',
            'inspection',
            'shortlet-booking',
            'document-verification',
          ],
          required: true,
        },
        paymentMode: {type: String},
        paymentDetails: {
          type: Schema.Types.Mixed,
          default: {},
        },
        platform: {
          type: String,
          default: 'web',
        },
        meta: {
          type: Schema.Types.Mixed,
          default: {},
        },
        transactionFlow: {
          type: String,
          enum: ['internal', 'external'],
          default: 'internal',
        },
      },
      {
        timestamps: true,
      }
    );

    schema.index({ reference: 1 });

    this.newTransactionModel = model<INewTransactionDoc>('newTransaction', schema);
  }

  public get model(): INewTransactionModel {
    return this.newTransactionModel;
  }
}
