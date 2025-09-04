import { Schema, model, Document, Model, Types, models } from 'mongoose';

export interface IInspectionActivityLog {
  inspectionId: Types.ObjectId;
  propertyId: Types.ObjectId;
  senderId: Types.ObjectId;
  senderModel: 'User' | 'Buyer' | 'Admin';
  senderRole: 'buyer' | 'seller' | 'admin';
  message: string;
  status?: string;
  stage?: 'inspection' | 'negotiation' | 'completed' | 'cancelled';
  meta?: Record<string, any>;
}

export interface IInspectionActivityLogDoc extends IInspectionActivityLog, Document {}

export type IInspectionActivityLogModel = Model<IInspectionActivityLogDoc>;

const schema = new Schema<IInspectionActivityLogDoc>(
  {
    inspectionId: { type: Schema.Types.ObjectId, ref: 'InspectionBooking', required: true },
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true },

    senderId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: 'senderModel',
    },
    senderModel: {
      type: String,
      required: true,
      enum: ['User', 'Buyer', 'Admin'],
    },
    senderRole: {
      type: String,
      enum: ['buyer', 'seller', 'admin'],
      required: true,
    },

    message: { type: String, required: true },
    status: { type: String },

    stage: {
      type: String,
      enum: ['inspection', 'negotiation', 'completed', 'cancelled'],
      default: 'inspection',
    },

    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// ✅ Compile model once
export const InspectionActivityLogModel =
  models.InspectionActivityLog ||
  model<IInspectionActivityLogDoc>('InspectionActivityLog', schema);
