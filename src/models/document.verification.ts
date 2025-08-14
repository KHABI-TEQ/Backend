import { Schema, model, Document, Model, Types } from 'mongoose';

export interface IDocumentVerification {
  buyerId: Types.ObjectId; // Reference to Buyer model
  docCode: string; // Grouping code
  amountPaid: number;
  transaction: Types.ObjectId;
  documents: {
    documentType: string;
    documentNumber?: string;
    documentUrl: string;
  };
  resultDocuments: string[];
  accessCode?: {
    token?: string;
    status?: 'pending' | 'approved';
  };
  status: 'pending' | 'confirmed' | 'rejected' | 'in-progress' | 'successful' | 'payment-failed';
  docType: 'certificate-of-occupancy' | 'deed-of-partition' | 'deed-of-assignment' | 'governors-consent' | 'survey-plan' | 'deed-of-lease';
  verificationReports?: {
    originalDocumentType: string;
    newDocumentUrl?: string;
    description?: string;
    status: 'verified' | 'rejected';
    verifiedAt?: Date;
  };
}

export interface IDocumentVerificationDoc extends IDocumentVerification, Document {}

export type IDocumentVerificationModel = Model<IDocumentVerificationDoc>;

export class DocumentVerification {
  private generalModel: Model<IDocumentVerificationDoc>;

  constructor() {
    const schema = new Schema(
      {
        buyerId: { type: Schema.Types.ObjectId, ref: 'Buyer', required: true },

        docCode: { type: String, required: true, index: true },

        amountPaid: { type: Number, required: true },
        transaction: {
          type: Schema.Types.ObjectId,
          ref: 'NewTransaction',
          required: true,
        },

        // CHANGED: documents is now a single object, not an array
        documents: {
          documentType: { type: String, required: true },
          documentNumber: { type: String },
          documentUrl: { type: String, required: true },
        },

        resultDocuments: [{ type: String }],

        accessCode: {
          token: { type: String },
          status: {
            type: String,
            enum: ['pending', 'approved'],
            default: 'pending',
          },
        },

        status: {
          type: String,
          enum: ['pending', 'confirmed', 'in-progress', 'rejected', 'successful', 'payment-failed'],
          default: 'pending',
        },

        docType: {
          type: String,
          enum: [
            'certificate-of-occupancy',
            'deed-of-partition',
            'deed-of-assignment',
            'governors-consent',
            'survey-plan',
            'deed-of-lease',
          ],
          required: true,
        },
        verificationReports: {
          originalDocumentType: { type: String, required: true },
          newDocumentUrl: { type: String },
          description: { type: String },
          status: { type: String, enum: ['verified', 'rejected'], required: true },
          verifiedAt: { type: Date },
        },
      },
      { timestamps: true }
    );

    // Auto-generate docCode if not provided
    schema.pre<IDocumentVerificationDoc>('save', async function (next) {
      if (this.isNew && !this.docCode) {
        this.docCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      }
      next();
    });

    this.generalModel = model<IDocumentVerificationDoc>('DocumentVerification', schema);
  }

  public get model(): Model<IDocumentVerificationDoc> {
    return this.generalModel;
  }
}
