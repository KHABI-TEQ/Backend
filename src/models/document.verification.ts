import { Schema, model, Document, Model, Types } from 'mongoose';
import { Counter } from './counter'; 
 
export interface IDocumentVerification {
  customId:string;
  fullName: string;
  email: string;
  phoneNumber: string;
  address: string;
  amountPaid: number;
  transaction: Types.ObjectId;
  documents: {
    documentType: string;
    documentNumber?: string;
    documentUrl: string;
  }[];
  resultDocuments: string[];
  status: 'pending' | 'confirmed'  | 'rejected' |  "in-progress" | 'successful' | 'payment-failed';
} 


export interface IDocumentVerificationDoc extends IDocumentVerification, Document {}

export type IDocumentVerificationModel = Model<IDocumentVerificationDoc>;

export class DocumentVerification {
  private generalModel: Model<IDocumentVerificationDoc>;

  constructor() {
    const schema = new Schema(
      { 
        customId: { type: String, unique: true },
        fullName: { type: String, required: true },
        email: { type: String, required: true},
        phoneNumber: { type: String, required: true },
        address: { type: String, required: true },
        amountPaid:{type: Number, required: true},
        transaction: {
          type: Schema.Types.ObjectId,
          ref: 'NewTransaction',
          required: true,
        },
        documents: [{ 
          documentType:{type: String, required: true },
          documentNumber:{type:String},
          documentUrl:{type:String, required: true},
        }],
        resultDocuments: [{ type: String }],
        status: {
          type: String,
          enum: ['pending', 'confirmed',  "in-progress", "rejected", 'successful', 'payment-failed'],
          default: 'pending',
        },
      },
      {
        timestamps: true,
      }
    );

    schema.pre<IDocumentVerificationDoc>('save', async function (next) {
    if (this.isNew) {
      const counter = await Counter.findOneAndUpdate(
        { model: 'DocumentVerification' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );

      const padded = String(counter.seq).padStart(4, '0');
      this.customId = padded;
    }
    next();
  });


    this.generalModel = model<IDocumentVerificationDoc>('DocumentVerification', schema);
  }

  public get model(): Model<IDocumentVerificationDoc> {
    return this.generalModel;
  }
}
