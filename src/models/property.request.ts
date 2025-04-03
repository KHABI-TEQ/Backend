import { Schema, model, Document, Model, ObjectId } from 'mongoose';
import { propertyOwner } from '../common/constants';

export interface IPropertyRequest {
  propertyId: ObjectId;
  requestFrom: ObjectId;
  status: 'Pending' | 'Accepted' | 'Rejected';
  propertyModel: 'PropertySell' | 'PropertyRent';
  inspectionDate?: Date;
  inspectionTime?: string;
  slotId?: ObjectId;
  // bookedBy?: string;
  // bookedByModel?: string;
}

export interface IPropertyRequestDoc extends IPropertyRequest, Document {}

export type IPropertyRequestModel = Model<IPropertyRequestDoc>;

export class PropertyRequest {
  private generalModel: Model<IPropertyRequestDoc>;

  constructor() {
    const schema = new Schema(
      {
        propertyId: { type: Schema.Types.ObjectId, refPath: 'propertyModel', required: true },
        requestFrom: { type: Schema.Types.ObjectId, ref: 'BuyerOrRenter', required: true },
        status: { type: String, required: true, enum: ['Pending', 'Accepted', 'Rejected'] },
        propertyModel: { type: String, required: true, enum: ['PropertySell', 'PropertyRent'] },
        inspectionDate: { type: Date },

        inspectionTime: { type: String },
        slotId: { type: Schema.Types.ObjectId, ref: 'InspectionSlot' },
        // bookedBy: { type: Schema.Types.ObjectId, refPath: 'bookedByModel' },
        // bookedByModel: { type: String }, // Can be 'BuyerOrRenter', 'Agent', etc.
      },
      {
        timestamps: true,
      }
    );

    this.generalModel = model<IPropertyRequestDoc>('PropertyRequest', schema);
  }

  public get model(): Model<IPropertyRequestDoc> {
    return this.generalModel;
  }
}
