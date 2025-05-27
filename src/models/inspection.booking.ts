import { model, Model, Schema, ObjectId } from 'mongoose';
import { ref } from 'process';

export interface IInspectionBooking {
  propertyId: ObjectId;
  // propertyModel: string;
  bookedBy: ObjectId;
  bookedByModel: string;
  inspectionDate: Date;
  inspectionTime: string;
  status: string;
  slotId: ObjectId;
  requestedBy: ObjectId;
  transaction: ObjectId;
  isNegotiating: boolean;
  negotiationPrice: number;
  letterOfIntention: string;
  owner: ObjectId;
  sellerCounterOffer?: number;
}

export interface IInspectionBookingDoc extends IInspectionBooking, Document {}

export type IInspectionBookingModel = Model<IInspectionBookingDoc>;

export class InspectionBooking {
  private InspectionBookingModel: Model<IInspectionBookingDoc>;

  constructor() {
    const schema = new Schema(
      {
        propertyId: { type: Schema.Types.ObjectId, required: true, ref: 'Property' },
        // propertyModel: { type: String, required: true },
        bookedBy: { type: Schema.Types.ObjectId },
        bookedByModel: { type: String },
        inspectionDate: { type: Date, required: true },
        inspectionTime: { type: String, required: true },
        status: { type: String, required: true, default: 'pending' },
        slotId: { type: Schema.Types.ObjectId },
        requestedBy: { type: Schema.Types.ObjectId, required: true, ref: 'Buyer' },
        transaction: { type: Schema.Types.ObjectId, required: true },
        isNegotiating: { type: Boolean, default: false },
        negotiationPrice: { type: Number, default: 0 },
        letterOfIntention: { type: String },
        owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        sellerCounterOffer: { type: Number, default: 0 },
      },
      { timestamps: true }
    );

    this.InspectionBookingModel = model<IInspectionBookingDoc>('InspectionBooking', schema);
  }

  public get model(): Model<IInspectionBookingDoc> {
    return this.InspectionBookingModel;
  }
}
