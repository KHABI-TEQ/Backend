import { number } from 'joi/lib';
import { Schema, model, Document, Model } from 'mongoose';

export interface IDocumentVerification {
  fullName: string;
  email: string;
  phoneNumber: string;
  address: string;
  amountPaid: number;
  transactionReceipt?: string;
  documents: {
    documentType: string;
    documentNumber: string;
    documentUrl: string;
  }[];
  resultDocuments: string[];
  status: 'pending' | 'confirmed' | 'rejected' | 'successful';
}


export interface IDocumentVerificationDoc extends IDocumentVerification, Document {}

export type IDocumentVerificationModel = Model<IDocumentVerificationDoc>;

export class DocumentVerification {
  private generalModel: Model<IDocumentVerificationDoc>;

  constructor() {
    const schema = new Schema(
      {
        fullName: { type: String, required: true },
        email: { type: String, required: true},
        phoneNumber: { type: String, required: true },
        address: { type: String, required: true },
        amountPaid:{type:Number,required: true},
        transactionReceipt:{type:String},
        documents: [{ 
          documentType:{type: String, required: true },
          documentNumber:{type:String, required: true},
          documentUrl:{type:String, required: true},
        }],
        resultDocuments: [{ type: String }],
        status: {
          type: String,
          enum: ['pending', 'confirmed', "rejected", 'successful'],
          default: 'pending',
        },
      },
      {
        timestamps: true,
      }
    );

    this.generalModel = model<IDocumentVerificationDoc>('DocumentVerification', schema);
  }

  public get model(): Model<IDocumentVerificationDoc> {
    return this.generalModel;
  }
}
