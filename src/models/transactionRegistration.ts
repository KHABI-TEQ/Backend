import { Schema, model, Document, Model, Types } from "mongoose";

export type TransactionRegistrationType =
  | "rental_agreement"
  | "outright_sale"
  | "off_plan_purchase"
  | "joint_venture";

export type TransactionRegistrationStatus =
  | "submitted"
  | "pending_completion"
  | "khabiteq_verified"
  | "forwarded_to_lasrera"
  | "info_requested"
  | "approved"
  | "certificate_issued"
  | "completed"
  | "rejected";

export interface IRegistrationWorkflowNotes {
  khabiteqVerificationNote?: string;
  lasreraReviewNote?: string;
  infoRequestMessage?: string;
}

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

export type TransactionRegistrationSource = "platform_listing" | "off_platform";

/** Off-platform counterparty the buyer transacted with (when not on KHABITEQ). */
export type OffPlatformPartyType = "agent" | "property_owner";

/** Real estate practitioner involved in the deal (on- or off-platform). */
export interface ITransactionPractitioner {
  fullName: string;
  email: string;
  phoneNumber: string;
  companyName?: string;
  licenceNumber?: string;
  isOnPlatform?: boolean;
}

export interface ITransactionRegistration {
  transactionType: TransactionRegistrationType;
  /** Platform listing reference — optional for off-platform properties. */
  propertyId?: Types.ObjectId;
  /** Platform agent reference when known. */
  agentId?: Types.ObjectId;
  registrationSource?: TransactionRegistrationSource;
  /** Set when the counterparty is not registered on KHABITEQ — agent or property owner. */
  offPlatformPartyType?: OffPlatformPartyType;
  practitioner?: ITransactionPractitioner;
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
  /** Deed of assignment file name (optional). */
  deedsOfAssignmentFileName?: string;
  deedsOfAssignmentBase64?: string;
  deedsOfAssignmentUrl?: string;
  /** Conveyance document file name (optional). */
  conveyanceFileName?: string;
  conveyanceBase64?: string;
  conveyanceUrl?: string;
  /** Paystack transaction ID for the processing fee (set when payment link is generated). */
  paymentTransactionId?: Types.ObjectId;
  workflowNotes?: IRegistrationWorkflowNotes;
  khabiteqVerifiedAt?: Date;
  khabiteqVerifiedBy?: Types.ObjectId;
  forwardedToLasreraAt?: Date;
  forwardedBy?: Types.ObjectId;
  lasreraReviewedAt?: Date;
  lasreraReviewedBy?: Types.ObjectId;
  certificateNumber?: string;
  certificateUrl?: string;
  certificateIssuedAt?: Date;
  certificateIssuedBy?: Types.ObjectId;
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
  "khabiteq_verified",
  "forwarded_to_lasrera",
  "info_requested",
  "approved",
  "certificate_issued",
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
        propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: false },
        agentId: { type: Schema.Types.ObjectId, ref: "Agent", required: false },
        registrationSource: {
          type: String,
          enum: ["platform_listing", "off_platform"],
          default: "platform_listing",
        },
        offPlatformPartyType: {
          type: String,
          enum: ["agent", "property_owner"],
          required: false,
        },
        practitioner: {
          fullName: { type: String, required: false },
          email: { type: String, required: false },
          phoneNumber: { type: String, required: false },
          companyName: { type: String, required: false },
          licenceNumber: { type: String, required: false },
          isOnPlatform: { type: Boolean, required: false },
        },
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
        deedsOfAssignmentFileName: { type: String, required: false },
        deedsOfAssignmentBase64: { type: String, required: false },
        deedsOfAssignmentUrl: { type: String, required: false },
        conveyanceFileName: { type: String, required: false },
        conveyanceBase64: { type: String, required: false },
        conveyanceUrl: { type: String, required: false },
        paymentTransactionId: { type: Schema.Types.ObjectId, ref: "newTransaction", required: false },
        workflowNotes: {
          khabiteqVerificationNote: { type: String, required: false },
          lasreraReviewNote: { type: String, required: false },
          infoRequestMessage: { type: String, required: false },
        },
        khabiteqVerifiedAt: { type: Date, required: false },
        khabiteqVerifiedBy: { type: Schema.Types.ObjectId, ref: "Admin", required: false },
        forwardedToLasreraAt: { type: Date, required: false },
        forwardedBy: { type: Schema.Types.ObjectId, ref: "Admin", required: false },
        lasreraReviewedAt: { type: Date, required: false },
        lasreraReviewedBy: { type: Schema.Types.ObjectId, ref: "Admin", required: false },
        certificateNumber: { type: String, required: false, index: true },
        certificateUrl: { type: String, required: false },
        certificateIssuedAt: { type: Date, required: false },
        certificateIssuedBy: { type: Schema.Types.ObjectId, ref: "Admin", required: false },
      },
      { timestamps: true }
    );

    schema.index({ propertyId: 1 }, { sparse: true });
    schema.index({ agentId: 1 }, { sparse: true });
    schema.index({ registrationSource: 1 });
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
