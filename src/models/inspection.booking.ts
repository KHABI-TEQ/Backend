import { model, Model, Schema, ObjectId } from 'mongoose';

export interface IInspectionBooking {
  propertyId: ObjectId;
  propertyModel: string;
  bookedBy: ObjectId;
  bookedByModel: string;
  inspectionDate: Date;
  inspectionTime: string;
  status: string;
  slotId: ObjectId;
}

export interface IInspectionBookingDoc extends IInspectionBooking, Document {}

export type IInspectionBookingModel = Model<IInspectionBookingDoc>;

export class InspectionBooking {
  private InspectionBookingModel: Model<IInspectionBookingDoc>;

  constructor() {
    const schema = new Schema(
      {
        propertyId: { type: Schema.Types.ObjectId, required: true },
        propertyModel: { type: String, required: true },
        bookedBy: { type: Schema.Types.ObjectId, required: true },
        bookedByModel: { type: String, required: true },
        inspectionDate: { type: Date, required: true },
        inspectionTime: { type: String, required: true },
        status: { type: String, required: true },
        slotId: { type: Schema.Types.ObjectId, required: true },
      },
      { timestamps: true }
    );

    this.InspectionBookingModel = model<IInspectionBookingDoc>('InspectionBooking', schema);
  }

  public get model(): Model<IInspectionBookingDoc> {
    return this.InspectionBookingModel;
  }
}
