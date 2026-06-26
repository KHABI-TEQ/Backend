import { Schema, model, Document, Model, Types } from "mongoose";

export type TransactionRegistrationType =
  | "rental_agreement"
  | "outright_sale"
  | "off_plan_purchase"
  | "joint_venture";

export type TransactionRegistrationStatus =
  | "submitted"
  | "pending_completion"
  | "completed"
  | "rejected";

export interface IPropertyIdentificationBuilding {
  type: "building";
  exactAddress: string;
  lpin?: string;
  titleReference?: string;
  ownerVerification?: string;
  gpsCoordinates?: { lat: number; lng: number };
}

export interface IPropertyIdentificationLand {
  type: "land";
  exactAddress?: string;
  gpsCoordinates: { lat: number; lng: number };
  surveyPlanDetails?: string;
  ownerConfirmation?: string;
}

export type IPropertyIdentification = IPropertyIdentificationBuilding | IPropertyIdentificationLand;

export interface ITransactionRegistration {
  transactionType: TransactionRegistrationType;
  propertyId: Types.ObjectId;
  inspectionId?: Types.ObjectId;
  buyer: {
    email: string;
    fullName: string;
    phoneNumber: string;
  };
  transactionValue: number;
  processingFee: number;
  status: TransactionRegistrationStatus;
  propertyIdentification: IPropertyIdentification;
  /** Deal payment receipt file name (from buyer registration upload). */
  paymentReceiptFileName?: string;
  /** Base64-encoded deal payment receipt. */
  paymentReceiptBase64?: string;
  /** Cloudinary URL for deal payment receipt (preferred over base64). */
  paymentReceiptUrl?: string;
  /** Buyer valid ID file name (from registration upload). */
  buyerIdFileName?: string;
  /** Base64-encoded buyer valid ID. */
  buyerIdBase64?: string;
  /** Cloudinary URL for buyer valid ID (preferred over base64). */
  buyerIdUrl?: string;
  /** Paystack transaction ID for the processing fee (set when payment link is generated). */
  paymentTransactionId?: Types.ObjectId;
}

export interface ITransactionRegistrationDoc extends ITransactionRegistration, Document {
  createdAt: Date;
  updatedAt: Date;
}

export type ITransactionRegistrationModel = Model<ITransactionRegistrationDoc>;

const TRANSACTION_TYPES: TransactionRegistrationType[] = [
  "rental_agreement",
  "outright_sale",
  "off_plan_purchase",
  "joint_venture",
];

const STATUSES: TransactionRegistrationStatus[] = [
  "submitted",
  "pending_completion",
  "completed",
  "rejected",
];

export class TransactionRegistration {
  private _model: ITransactionRegistrationModel;

  constructor() {
    const schema = new Schema<ITransactionRegistrationDoc>(
      {
        transactionType: {
          type: String,
          enum: TRANSACTION_TYPES,
          required: true,
        },
        propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true },
        inspectionId: { type: Schema.Types.ObjectId, ref: "InspectionBooking" },
        buyer: {
          email: { type: String, required: true },
          fullName: { type: String, required: true },
          phoneNumber: { type: String, required: true },
        },
        transactionValue: { type: Number, required: true, min: 0 },
        processingFee: { type: Number, required: true, min: 0 },
        status: {
          type: String,
          enum: STATUSES,
          default: "submitted",
        },
        propertyIdentification: {
          type: Schema.Types.Mixed,
          required: true,
        },
        paymentReceiptFileName: { type: String, required: false },
        paymentReceiptBase64: { type: String, required: false },
        paymentReceiptUrl: { type: String, required: false },
        buyerIdFileName: { type: String, required: false },
        buyerIdBase64: { type: String, required: false },
        buyerIdUrl: { type: String, required: false },
        paymentTransactionId: { type: Schema.Types.ObjectId, ref: "newTransaction", required: false },
      },
      { timestamps: true }
    );

    schema.index({ propertyId: 1 });
    schema.index({ inspectionId: 1 });
    schema.index({ status: 1 });
    schema.index({ "propertyIdentification.exactAddress": "text" });
    schema.index({ "propertyIdentification.lpin": 1 });

    this._model = model<ITransactionRegistrationDoc>("TransactionRegistration", schema);
  }

  public get model(): ITransactionRegistrationModel {
    return this._model;
  }
}
