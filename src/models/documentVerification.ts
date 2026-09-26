import { Schema, model, Document, Model, Types } from 'mongoose';

export type DocumentVerificationStatus =
  | 'awaiting-acceptance'
  | 'awaiting-payment'
  | 'declined'
  | 'pending'
  | 'registered'
  | 'unregistered'
  | 'in-progress'
  | 'payment-approved'
  | 'payment-failed';

export interface IDocumentVerification {
  buyerId: Types.ObjectId;
  /** Assigned marketplace lawyer (User id) when buyer selects one. */
  lawyerId?: Types.ObjectId;
  docCode: string;
  amountPaid?: number;
  transaction?: Types.ObjectId;
  documents: {
    documentType: string;
    documentNumber?: string;
    documentUrl: string;
  };
  accessCode?: {
    token?: string;
    status?: 'pending' | 'approved';
  };
  status: DocumentVerificationStatus;
  docType:
    | 'certificate-of-occupancy'
    | 'deed-of-partition'
    | 'deed-of-assignment'
    | 'governors-consent'
    | 'survey-plan'
    | 'deed-of-lease'
    | 'deed-of-conveyance-or-sale'
    | 'land-certificate';
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
  respondedAt?: Date;
  declineReason?: string;
  /** marketplace = accept-then-pay; public-page = immediate Paystack */
  source?: "marketplace" | "public-page";
  inspectionId?: Types.ObjectId;
  propertyId?: Types.ObjectId;
  preferenceId?: Types.ObjectId;
}

export interface IDocumentVerificationDoc extends IDocumentVerification, Document {}

export type IDocumentVerificationModel = Model<IDocumentVerificationDoc>;

export class DocumentVerification {
  private generalModel: Model<IDocumentVerificationDoc>;

  constructor() {
    const schema = new Schema(
      {
        buyerId: { type: Schema.Types.ObjectId, ref: 'Buyer', required: true },
        lawyerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },

        docCode: { type: String, required: true, index: true },

        amountPaid: { type: Number, min: 0 },
        transaction: {
          type: Schema.Types.ObjectId,
          ref: 'NewTransaction',
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
          enum: [
            'awaiting-acceptance',
            'awaiting-payment',
            'declined',
            'pending',
            'registered',
            'in-progress',
            'unregistered',
            'payment-approved',
            'payment-failed',
          ],
          default: 'awaiting-acceptance',
          index: true,
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
            'deed-of-conveyance-or-sale',
            'land-certificate',
          ],
          required: true,
        },
        verificationReports: {
          originalDocumentType: { type: String },
          newDocumentUrl: { type: String },
          description: { type: String },
          status: {
            type: String,
            enum: ['registered', 'unregistered', 'pending'],
            default: 'pending',
          },
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

        respondedAt: { type: Date },
        declineReason: { type: String, trim: true },
        source: {
          type: String,
          enum: ["marketplace", "public-page"],
          default: "marketplace",
          index: true,
        },
        inspectionId: { type: Schema.Types.ObjectId, ref: "InspectionBooking", index: true },
        propertyId: { type: Schema.Types.ObjectId, ref: "Property", index: true },
        preferenceId: { type: Schema.Types.ObjectId, ref: "Preference", index: true },
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

    this.generalModel = model<IDocumentVerificationDoc>(
      'DocumentVerification',
      schema
    );
  }

  public get model(): Model<IDocumentVerificationDoc> {
    return this.generalModel;
  }
}
