import { model, Model, Schema, ObjectId, Document } from 'mongoose';

/**
 * Interface for Inspection Booking records.
 */
export interface IInspectionBooking {
  propertyId: ObjectId;
  bookedBy: ObjectId;
  bookedByModel: string;
  inspectionDate: Date;
  inspectionTime: string;

  
  status:
    | 'pending_transaction'
    | 'transaction_failed'
    | 'pending_inspection'
    | 'inspection_approved'
    | 'inspection_rescheduled'
    | 'inspection_rejected_by_seller'
    | 'inspection_rejected_by_buyer'
    | 'negotiation_countered'
    | 'negotiation_accepted'
    | 'negotiation_rejected'
    | 'negotiation_cancelled'
    | 'completed'
    | 'cancelled';

  slotId: ObjectId;
  requestedBy: ObjectId;
  transaction: ObjectId;
  isNegotiating: boolean;
  negotiationPrice: number;
  letterOfIntention: string;
  owner: ObjectId;
  sellerCounterOffer?: number;

 
  pendingResponseFrom?: 'buyer' | 'seller' | 'none';

  
  stage: 'inspection' | 'negotiation' | 'LOI';
}

export interface IInspectionBookingDoc extends IInspectionBooking, Document {}

export type IInspectionBookingModel = Model<IInspectionBookingDoc>;

export class InspectionBooking {
  private InspectionBookingModel: Model<IInspectionBookingDoc>;

  constructor() {
    const schema = new Schema(
      {
        propertyId: { type: Schema.Types.ObjectId, required: true, ref: 'Property' },
        bookedBy: { type: Schema.Types.ObjectId },
        bookedByModel: { type: String },
        inspectionDate: { type: Date, required: true },
        inspectionTime: { type: String, required: true },
        status: {
          type: String,
          required: true,
          enum: [
            'pending_transaction',
            'transaction_failed',
            'pending_inspection',
            'inspection_approved',
            'inspection_rescheduled',
            'inspection_rejected_by_seller',
            'inspection_rejected_by_buyer',
            'negotiation_countered',
            'negotiation_accepted',
            'negotiation_rejected',
            'negotiation_cancelled',
            'completed',
            'cancelled',
          ],
          default: 'pending_transaction',
        },
        slotId: { type: Schema.Types.ObjectId },
        requestedBy: { type: Schema.Types.ObjectId, required: true, ref: 'Buyer' },
        transaction: { type: Schema.Types.ObjectId, required: true, ref: 'Transaction' },
        isNegotiating: { type: Boolean, default: false },
        negotiationPrice: { type: Number, default: 0 },
        letterOfIntention: { type: String },
        owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        sellerCounterOffer: { type: Number, default: 0 },
        pendingResponseFrom: {
          type: String,
          enum: ['buyer', 'seller', 'none'],
          default: 'none',
          required: false,
        },
        stage: { // Added this field to the schema
          type: String,
          required: true,
          enum: ['negotiation', 'inspection', 'LOI'],
          default: 'negotiation', // You can set a default initial stage
        },
      },
      { timestamps: true }
    );

    this.InspectionBookingModel = model<IInspectionBookingDoc>('InspectionBooking', schema);
  }

  public get model(): Model<IInspectionBookingDoc> {
    return this.InspectionBookingModel;
  }
}