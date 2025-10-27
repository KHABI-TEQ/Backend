import { Schema, model, models, Document, Types, Model } from "mongoose";

export interface IInspectionBooking {
  propertyId: Types.ObjectId;
  bookedBy: Types.ObjectId;
  bookedByModel: string;
  inspectionDate: Date;
  inspectionTime: string;
 
  status:
    | "pending_transaction"
    | "transaction_failed"
    | "active_negotiation"
    | "inspection_approved"
    | "inspection_rescheduled"
    | "negotiation_countered"
    | "negotiation_accepted"
    | "negotiation_rejected"
    | "negotiation_cancelled"
    | "completed"
    | "cancelled";

  requestedBy: Types.ObjectId;
  transaction: Types.ObjectId;
  isNegotiating: boolean;
  isLOI: boolean;
  inspectionType: "price" | "LOI";
  inspectionMode: "in_person" | "virtual";
  inspectionStatus?: "accepted" | "rejected" | "countered" | "new";

  negotiationPrice: number;
  letterOfIntention?: string;
  reason?: string;
  assignedFieldAgent?: Types.ObjectId;

  owner: Types.ObjectId;
  approveLOI?: boolean;
  pendingResponseFrom?: "buyer" | "seller" | "admin";
  stage: "negotiation" | "inspection" | "completed" | "cancelled";

  inspectionReport?: {
    buyerPresent?: boolean;
    sellerPresent?: boolean;
    buyerInterest?: "very-interested" | "interested" | "neutral" | "not-interested";
    status:
      | "pending"
      | "in-progress"
      | "awaiting-report"
      | "postponed"
      | "completed"
      | "cancelled"
      | "absent";
    notes?: string;
    wasSuccessful?: boolean;
    inspectionStartedAt?: Date;
    inspectionCompletedAt?: Date;
    submittedAt?: Date;
  };

  counterCount: number;
 
  propertyType: "jv" | "shortlet" | "buy" | "rent";
  receiverMode: {
    type?: "general" | "dealSite";
    dealSiteID?: Types.ObjectId;
  };

  meta?: Record<string, any>;
}

export interface IInspectionBookingDoc extends IInspectionBooking, Document {
  createdAt: Date;
  updatedAt: Date;
} 
 
export type IInspectionBookingModel = Model<IInspectionBookingDoc>;

export class InspectionBooking {
  private InspectionBookingModel: IInspectionBookingModel;

  constructor() {
    const schema = new Schema<IInspectionBookingDoc>(
      {
        propertyId: { type: Schema.Types.ObjectId, required: true, ref: "Property" },
        bookedBy: { type: Schema.Types.ObjectId, required: true },
        bookedByModel: { type: String, required: true },
        inspectionDate: { type: Date, required: true },
        inspectionTime: { type: String, required: true },

        status: {
          type: String,
          enum: [
            "pending_transaction",
            "transaction_failed",
            "active_negotiation",
            "inspection_approved",
            "inspection_rescheduled",
            "negotiation_countered",
            "negotiation_accepted",
            "negotiation_rejected",
            "negotiation_cancelled",
            "completed",
            "cancelled",
          ],
          default: "pending_transaction",
        },

        requestedBy: { type: Schema.Types.ObjectId, required: true, ref: "Buyer" },
        transaction: { type: Schema.Types.ObjectId, ref: "newTransaction", required: true },

        isNegotiating: { type: Boolean, default: false },
        isLOI: { type: Boolean, default: false },
        inspectionType: {
          type: String,
          enum: ["price", "LOI"],
          default: "price",
        },
        inspectionMode: {
          type: String,
          enum: ["in_person", "virtual"],
          required: true,
        },
        inspectionStatus: {
          type: String,
          enum: ["accepted", "rejected", "countered", "new"],
          default: "new",
        },

        negotiationPrice: { type: Number, default: 0 },
        letterOfIntention: { type: String },
        reason: { type: String },
        assignedFieldAgent: { type: Schema.Types.ObjectId, ref: "User" },
        owner: { type: Schema.Types.ObjectId, required: true, ref: "User" },
        approveLOI: { type: Boolean, default: false },
        pendingResponseFrom: {
          type: String,
          enum: ["buyer", "seller", "admin"],
          default: "admin",
        },
        stage: {
          type: String,
          enum: ["negotiation", "inspection", "completed", "cancelled"],
          default: "negotiation",
        },
        counterCount: { type: Number, default: 0 },

        inspectionReport: {
          buyerPresent: { type: Boolean, default: false },
          sellerPresent: { type: Boolean, default: false },
          buyerInterest: {
            type: String,
            enum: ["very-interested", "interested", "neutral", "not-interested"],
            default: null,
          },
          notes: { type: String, default: null },
          status: {
            type: String,
            enum: [
              "pending",
              "in-progress",
              "awaiting-report",
              "postponed",
              "completed",
              "cancelled",
              "absent",
            ],
            default: "pending",
          },
          wasSuccessful: { type: Boolean, default: false },
          inspectionStartedAt: { type: Date },
          inspectionCompletedAt: { type: Date },
          submittedAt: { type: Date },
        },

        propertyType: {
          type: String,
          enum: ["jv", "shortlet", "buy", "rent"],
          default: "buy",
        },
        receiverMode: {
          type: {
            type: String,
            enum: ["general", "dealSite"],
            default: "general",
          },
          dealSiteID: { type: Schema.Types.ObjectId, ref: "DealSite" }
        },
        meta: { type: Schema.Types.Mixed, default: {} },
      },
      {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
      }
    );

    this.InspectionBookingModel =
      models.InspectionBooking || model<IInspectionBookingDoc>("InspectionBooking", schema);
  }

  public get model(): IInspectionBookingModel {
    return this.InspectionBookingModel;
  }

  public async canCounter(id: string): Promise<boolean> {
    const record = await this.model.findById(id);
    return !!record && record.counterCount < 3;
  }
}
