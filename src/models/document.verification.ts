import { Schema, model, Document, Model } from 'mongoose';

export interface IDocumentVerification {
  fullName: string;
  email: string;
  phoneNumber: string;
  address: string;
  documents: string[];
  resultDocuments: string[];
  status: 'pending' | 'approved' | 'uploaded';
}

export interface IDocumentVerificationDoc extends IDocumentVerification, Document {}

export type IDocumentVerificationModel = Model<IDocumentVerificationDoc>;

export class DocumentVerification {
  private generalModel: Model<IDocumentVerificationDoc>;

  constructor() {
    const schema = new Schema(
      {
        fullName: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        phoneNumber: { type: String, required: true },
        address: { type: String, required: true },
        documents: [{ type: String, required: true }],
        resultDocuments: [{ type: String }],
        status: {
          type: String,
          enum: ['pending', 'approved', 'uploaded'],
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
