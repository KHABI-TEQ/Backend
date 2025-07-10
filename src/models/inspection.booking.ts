import { Schema, model, Document, Types, Model } from 'mongoose';

/**
 * Interface for Inspection Booking records.
 */
export interface IInspectionBooking {
  propertyId: Types.ObjectId;
  bookedBy: Types.ObjectId;
  bookedByModel: string;
  inspectionDate: Date;
  inspectionTime: string;

  status:
    | 'pending_transaction'
    | 'transaction_failed'
    | 'active_negotiation'
    | 'inspection_approved'
    | 'inspection_rescheduled'
    | 'negotiation_countered'
    | 'negotiation_accepted'
    | 'negotiation_rejected'
    | 'negotiation_cancelled'
    | 'completed'
    | 'cancelled';

  slotId: Types.ObjectId;
  requestedBy: Types.ObjectId;
  transaction: Types.ObjectId;

  isNegotiating: boolean;
  isLOI: boolean;
  inspectionType: 'price' | 'LOI';
  inspectionStatus?: 'accepted' | 'rejected' | 'countered' | 'requested_changes' | 'new';

  negotiationPrice: number;
  letterOfIntention?: string;
  reason?: string;

  owner: Types.ObjectId;

  pendingResponseFrom?: 'buyer' | 'seller' | 'admin';
  stage: 'negotiation' | 'inspection' | 'completed' | 'cancelled';
}

export interface IInspectionBookingDoc extends IInspectionBooking, Document {}

export type IInspectionBookingModel = Model<IInspectionBookingDoc>;

export class InspectionBooking {
  private InspectionBookingModel: IInspectionBookingModel;

  constructor() {
    const schema = new Schema<IInspectionBookingDoc>(
      {
        propertyId: { type: Schema.Types.ObjectId, required: true, ref: 'Property' },
        bookedBy: { type: Schema.Types.ObjectId },
        bookedByModel: { type: String },
        inspectionDate: { type: Date },
        inspectionTime: { type: String },

        status: {
          type: String,
          required: true,
          enum: [
             'pending_transaction',
             'transaction_failed',
             'active_negotiation',
             'inspection_approved',
             'inspection_rescheduled',
             'negotiation_countered',
             'negotiation_accepted',
             'negotiation_rejected',
             'negotiation_cancelled',
             'completed',
             'cancelled'
          ],
          default: 'pending_transaction',
        },

        slotId: { type: Schema.Types.ObjectId },
        requestedBy: { type: Schema.Types.ObjectId, required: true, ref: 'Buyer' },
        transaction: { type: Schema.Types.ObjectId, required: true, ref: 'Transaction' },

        isNegotiating: { type: Boolean, default: false },
        isLOI: { type: Boolean, default: false },
 
        inspectionType: {
          type: String,
          enum: ['price', 'LOI'],
          default: 'price',
        },

        inspectionStatus: {
          type: String,
          enum: ['accepted', 'rejected', 'countered', 'requested_changes', 'new'],
          default: 'new',
        },

        negotiationPrice: { type: Number, default: 0 },
        letterOfIntention: { type: String },

        reason: { type: String },

        owner: { type: Schema.Types.ObjectId, required: true, ref: 'User' },

        pendingResponseFrom: {
          type: String,
          enum: ['buyer', 'seller', 'admin'],
          default: 'admin',
        },

        stage: {
          type: String,
          enum: ['negotiation', 'inspection', 'completed', 'cancelled'],
          default: 'negotiation',
        },
      },
      { timestamps: true }
    );

    this.InspectionBookingModel = model<IInspectionBookingDoc>('InspectionBooking', schema);
  }

  public get model(): IInspectionBookingModel {
    return this.InspectionBookingModel;
  }
}
