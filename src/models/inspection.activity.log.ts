import { Schema, model, Document, Model, Types, models } from 'mongoose';

export interface IInspectionActivityLog {
  inspectionId: Types.ObjectId;
  propertyId: Types.ObjectId;
  senderId: Types.ObjectId;
  senderRole: 'buyer' | 'seller' | 'admin';
  message: string;
  status?: string;
  stage?: 'inspection' | 'negotiation' | 'LOI';
  meta?: Record<string, any>;
}

export interface IInspectionActivityLogDoc extends IInspectionActivityLog, Document {}

export type IInspectionActivityLogModel = Model<IInspectionActivityLogDoc>;

const schema = new Schema<IInspectionActivityLogDoc>(
  {
    inspectionId: { type: Schema.Types.ObjectId, ref: 'InspectionBooking', required: true },
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: {
      type: String,
      enum: ['buyer', 'seller', 'admin'],
      required: true,
    },
    message: { type: String, required: true },
    status: { type: String },
    stage: {
      type: String,
      enum: ['inspection', 'negotiation', 'LOI'],
      default: 'inspection',
    },
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// ✅ Only compile if not already registered
export const InspectionActivityLogModel =
  models.InspectionActivityLog ||
  model<IInspectionActivityLogDoc>('InspectionActivityLog', schema);
