import { Schema, model, Document, Model, Types } from "mongoose";

export interface IBookingData {
  checkInDateTime: Date;
  checkOutDateTime: Date;
  guestNumber: number;
  note?: string;
}

export interface IOwnerResponse {
  response: "accepted" | "declined" | "pending";
  respondedAt?: Date;
  note?: string;
}
  
export interface IBooking {
  propertyId: Types.ObjectId;               // Ref -> Property
  bookedBy: Types.ObjectId;                 // Ref -> Buyer
  bookingCode: string;                      // Unique booking reference
  passCode?: string;                        // Extra security for check-in/out
  bookingDetails: IBookingData;          // Check-in/out, guests, note
  status: "pending" | "confirmed" | "cancelled" | "completed" | "failed" | "requested" | "unavailable";
  transaction?: Types.ObjectId;              // Ref -> NewTransaction
  ownerResponse?: IOwnerResponse;           // Owner’s decision about booking
  ownerId: Types.ObjectId;
  ownerModel: "User" | "Admin";
  report?: string;                          // Notes/report after booking
  meta?: Record<string, any>; 
  receiverMode: {
    type?: "general" | "dealSite";
    dealSiteID?: Types.ObjectId;
  };
} 
  
export interface IBookingDoc extends IBooking, Document {}
export type IBookingModel = Model<IBookingDoc>;

export class Booking {
  private bookingModel: IBookingModel;

  constructor() {
    const schema = new Schema<IBookingDoc>(
      {
        propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true },
        bookedBy: { type: Schema.Types.ObjectId, ref: "Buyer", required: true },
        bookingCode: { type: String, required: true, unique: true },
        passCode: { type: String, default: null }, // Secure check-in code

        bookingDetails: {
          checkInDateTime: { type: Date, required: true },
          checkOutDateTime: { type: Date, required: true },
          guestNumber: { type: Number, required: true },
          note: { type: String, default: null },
        },
 
        status: {
          type: String,
          enum: ["pending", "confirmed", "cancelled", "completed", "failed", "requested", "unavailable"],
          default: "pending",
        },
 
        transaction: {
          type: Schema.Types.ObjectId,
          ref: 'newTransaction',
          default: null,
        },

        ownerResponse: {
          response: {
            type: String,
            enum: ["accepted", "declined", "pending"],
            default: "pending",
          },
          respondedAt: { type: Date },
          note: { type: String, default: null },
        },

        ownerId: { 
          type: Schema.Types.ObjectId, 
          required: true, 
          refPath: "ownerModel" // dynamic reference
        },
        ownerModel: {
          type: String,
          required: true,
          enum: ["User", "Admin"], // tells Mongoose which collection to use
        },

        report: { type: String, default: null },
        meta: { type: Schema.Types.Mixed },

        receiverMode: {
          type: {
            type: String,
            enum: ["general", "dealSite"],
            default: "general",
          },
          dealSiteID: { type: Schema.Types.ObjectId, ref: "DealSite" }
        },
      },
      { timestamps: true }
    );

    this.bookingModel = model<IBookingDoc>("Booking", schema);
  }

  public get model(): IBookingModel {
    return this.bookingModel;
  }
}
