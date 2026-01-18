import { Schema, model, Document, Model, Types } from 'mongoose';

export interface IDocumentVerification {
  buyerId: Types.ObjectId;
  docCode: string;
  amountPaid: number;
  transaction: Types.ObjectId;
  documents: {
    documentType: string;
    documentNumber?: string;
    documentUrl: string;
  }; 
  accessCode?: { 
    token?: string;
    status?: 'pending' | 'approved';
  };
  status: 'pending' | 'registered' | 'unregistered' | 'in-progress' | 'payment-approved' | 'payment-failed';
  docType: 'certificate-of-occupancy' | 'deed-of-partition' | 'deed-of-assignment' | 'governors-consent' | 'survey-plan' | 'deed-of-lease';
  verificationReports?: { 
    originalDocumentType?: string;
    newDocumentUrl?: string;
    description?: string;
    status?: 'registered' | 'unregistered' | 'pending';
    verifiedAt?: Date;
    selfVerification: boolean;
  };
   additionalDocuments?: {
    name: string;
    documentFile: string;
    comment?: string;
    uploadedAt?: Date;
  }[];
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

        documents: {
          documentType: { type: String, required: true },
          documentNumber: { type: String },
          documentUrl: { type: String },
        },
 
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
          enum: ['pending', 'registered', 'in-progress', 'unregistered', 'payment-approved', 'payment-failed'],
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
          originalDocumentType: { type: String },
          newDocumentUrl: { type: String },
          description: { type: String },
          status: { type: String, enum: ['registered', 'unregistered', 'pending'], default: 'pending', },
          verifiedAt: { type: Date },
          selfVerification: { type: Boolean, default: false },
        },

        additionalDocuments: [
          {
            name: { type: String, required: true },
            documentFile: { type: String, required: true },
            comment: { type: String },
            uploadedAt: { type: Date, default: Date.now },
          },
        ],

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
