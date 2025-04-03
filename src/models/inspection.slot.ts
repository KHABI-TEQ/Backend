import { model, Model, Schema } from 'mongoose';

export interface IInspectionSlot {
  slotDay: string;
  slotDate: Date;
  slotStartTime: string;
  slotEndTime: string;
  slotStatus: string;
  bookedCount: number;
}

export interface IInspectionSlotDoc extends IInspectionSlot, Document {}

export type IInspectionSlotModel = Model<IInspectionSlotDoc>;

export class InspectionSlot {
  private InspectionSlotModel: Model<IInspectionSlotDoc>;

  constructor() {
    const schema = new Schema(
      {
        slotDay: { type: String, required: true },
        slotDate: { type: Date, required: true },
        slotStartTime: { type: String, required: true },
        slotEndTime: { type: String, required: true },
        slotStatus: { type: String, required: true },
        bookedCount: { type: Number, default: 0 },
      },
      { timestamps: true }
    );

    this.InspectionSlotModel = model<IInspectionSlotDoc>('InspectionSlot', schema);
  }

  public get model(): Model<IInspectionSlotDoc> {
    return this.InspectionSlotModel;
  }
}
