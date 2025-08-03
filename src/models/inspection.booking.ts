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
    notes?: string;
    wasSuccessful?: boolean;
    submittedAt?: Date;
  };

  counterCount: number;
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
        transaction: { type: Schema.Types.ObjectId, required: true, ref: "Transaction" },
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
          buyerPresent: { type: Boolean, default: null },
          sellerPresent: { type: Boolean, default: null },
          notes: { type: String },
          wasSuccessful: { type: Boolean },
          submittedAt: { type: Date },
        },
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
