import { Schema, model, Document, Model, Types, models } from 'mongoose';
 
export interface IBookingActivityLog {
  bookingId: Types.ObjectId;                     // Reference to booking
  propertyId: Types.ObjectId;                    // Reference to property
  senderId: Types.ObjectId;                      // Who sent the log (User, Buyer, Admin)
  senderModel: 'User' | 'Buyer' | 'Admin';       // Ref path
  senderRole: 'buyer' | 'owner' | 'admin';       // Role in booking context
  message: string;                               // Log message (e.g., "Booking accepted")
  status?: 'requested' | 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed';  
  stage?: 'booking' | 'payment' | 'checkin' | 'checkout' | 'completed' | 'cancelled';
  meta?: Record<string, any>;                    // Extra metadata (e.g., amount, dates, IP)
} 

export interface IBookingActivityLogDoc extends IBookingActivityLog, Document {}

export type IBookingActivityLogModel = Model<IBookingActivityLogDoc>;

const schema = new Schema<IBookingActivityLogDoc>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
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
      enum: ['buyer', 'owner', 'admin'],
      required: true,
    },

    message: { type: String, required: true },

    status: {
      type: String,
      enum: ['requested', 'pending', 'accepted', 'rejected', 'cancelled', 'completed'],
    },

    stage: {
      type: String,
      enum: ['booking', 'payment', 'checkin', 'checkout', 'completed', 'cancelled'],
      default: 'booking',
    },

    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// ✅ Compile model once
export const BookingActivityLogModel =
  models.BookingActivityLog ||
  model<IBookingActivityLogDoc>('BookingActivityLog', schema);
