import { Schema, model, Document, Model, ObjectId } from 'mongoose';
import { propertyOwner } from '../common/constants';

export interface ITransaction {
  buyerId: ObjectId; // ObjectId of the buyer
  bank: string;
  accountNumber: string;
  accountName: string;
  transactionReference: string;
  transactionReceipt: string;
  propertyId: ObjectId; // ObjectId of the property
}

export interface ITransactionDoc extends ITransaction, Document {}

export type ITransactionModel = Model<ITransactionDoc>;

export class Transaction {
  private generalModel: Model<ITransactionDoc>;

  constructor() {
    const schema = new Schema(
      {
        buyerId: { type: Schema.Types.ObjectId, required: true, ref: 'Buyer' }, // Assuming buyerId is a string, change to ObjectId if needed
        bank: { type: String },
        accountNumber: { type: String },
        accountName: { type: String },
        transactionReference: { type: String },
        transactionReceipt: { type: String },
        propertyId: { type: Schema.Types.ObjectId, ref: 'Property' }, // Assuming propertyId is a string
      },
      {
        timestamps: true,
      }
    );

    this.generalModel = model<ITransactionDoc>('Transaction', schema);
  }

  public get model(): Model<ITransactionDoc> {
    return this.generalModel;
  }
}
