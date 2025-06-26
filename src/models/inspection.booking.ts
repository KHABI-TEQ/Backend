import { model, Model, Schema, ObjectId, Document } from 'mongoose';

export interface IInspectionBooking {
  propertyId: ObjectId;
  // propertyModel: string;
  bookedBy: ObjectId;
  bookedByModel: string;
  inspectionDate: Date;
  inspectionTime: string;
  /**
   * Status of the inspection/negotiation process.
   * - 'pending_inspection': Initial state, inspection requested.
   * - 'inspection_approved': Inspection date/time confirmed.
   * - 'inspection_rescheduled': Inspection date/time changed.
   * - 'inspection_rejected_by_seller': Seller rejected the inspection request.
   * - 'inspection_rejected_by_buyer': Buyer rejected the inspection.
   * - 'negotiation_countered': A counter offer has been made (by either buyer or seller).
   * - 'negotiation_accepted': Negotiation concluded successfully, offer accepted.
   * - 'negotiation_rejected': Negotiation concluded, offer rejected (by either buyer or seller).
   * - 'negotiation_cancelled': Negotiation cancelled by either party.
   * - 'completed': Inspection or entire process successfully completed.
   * - 'cancelled': Overall booking/process cancelled.
   */
  status:
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
  /**
   * Indicates whose response is currently pending in the negotiation/inspection flow.
   * 'buyer': Awaiting a response from the buyer.
   * 'seller': Awaiting a response from the seller.
   * 'none': No response is currently pending (e.g., negotiation concluded or initial state).
   */
  pendingResponseFrom?: 'buyer' | 'seller' | 'none';
  /**
   * Represents the current stage of the booking process.
   * - 'inspection': The process is currently focused on inspection.
   * - 'negotiation': The process is currently focused on negotiation.
   * - 'LOI': The process is at the Letter of Intention stage.
   */
  stage: 'inspection' | 'negotiation' | 'LOI'; // Added this field
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
            'pending',
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
          default: 'pending',
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