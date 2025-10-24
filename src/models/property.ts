import { Document, model, Model, Types, Schema } from "mongoose";
  
export interface IBookedPeriod {
  bookingId: Types.ObjectId;
  checkInDateTime: Date;
  checkOutDateTime: Date;
}
 
export interface IProperty {  
  propertyType: string;
  propertyCategory: string;
  propertyCondition?: string;
  typeOfBuilding?: string;
  rentalType?: string;
  shortletDuration?: string;
  holdDuration?: string;
  price?: number;
  location?: {
    state?: string;
    localGovernment?: string;
    area?: string;
    streetAddress?: string;
  }; 
  landSize?: {
    measurementType?: string;
    size?: number;
  }; 
  docOnProperty?: {
    docName?: string;
    isProvided?: boolean;
  }[];
  owner: Types.ObjectId;                // ID of the owner
  ownerModel: "User" | "Admin";         // tells Mongoose which collection
  createdByRole: "user" | "admin"; 
  areYouTheOwner: boolean;
  leaseHold?: string;
  features?: string[];
  tenantCriteria?: string[];
  rentalConditions?: {
    conditions?: string[];
    tenantGenderPreference?: string;
  };
  additionalFeatures?: {
    noOfBedroom?: number;
    noOfBathroom?: number;
    noOfToilet?: number;
    noOfCarPark?: number;
  };
  jvConditions?: string[];
  shortletDetails?: {
    streetAddress?: string;
    maxGuests?: number;
    availability?: { 
      minStay: number 
    };
    pricing?: { 
      nightly: number; 
      weeklyDiscount?: number; 
      monthlyDiscount?: number; 
      cleaningFee?: number; 
      securityDeposit: number; 
    };
    houseRules?: { 
      checkIn: string; 
      checkOut: string, 
      smoking?: boolean; 
      pets?: boolean; 
      parties?: boolean; 
      otherRules?: string 
    };
    cancellationPolicy?: string;
  };
  pictures?: string[];
  videos?: string[];
  employmentType?: string;
  tenantGenderPreferences?: string;
  description?: string;
  addtionalInfo?: string;
  isTenanted?: string;
  isAvailable?: boolean;
  status:
    | "rejected"
    | "approved"
    | "pending"
    | "deleted"
    | "flagged"
    | "available"
    | "unavailable"
    | "sold"
    | "active"
    | "contingent"
    | "under_contract"
    | "coming_soon"
    | "expired"
    | "withdrawn"
    | "cancelled"
    | "back_on_market"
    | "temporarily_off_market"
    | "hold"
    | "failed"
    | "never_listed"
    | "booked";
  reason?: string;
  briefType: string;
  isPremium: boolean;
  isApproved?: boolean;
  isDeleted?: boolean;
  isRejected?: boolean;
  bookedPeriods?: IBookedPeriod[];
  createdAt?: Date;
  updatedAt?: Date;
}
 
export interface IPropertyDoc extends IProperty, Document {}

export type IPropertyModel = Model<IPropertyDoc>;
  
export class Property {
  private propertyModel: Model<IPropertyDoc>;

  constructor() {

    const schema = new Schema<IPropertyDoc>(
      {
        propertyType: { type: String, required: true },
        propertyCategory: { type: String },
        propertyCondition: { type: String },
        typeOfBuilding: { type: String },
        rentalType: { type: String },
        shortletDuration: { type: String },
        holdDuration: { type: String },
        price: { type: Number },
        location: {
          state: { type: String },
          localGovernment: { type: String },
          area: { type: String },
          streetAddress: { type: String },
        },
        landSize: {
          measurementType: { type: String },
          size: { type: Number },
        }, 
        docOnProperty: [
          {
            docName: { type: String },
            isProvided: { type: Boolean },
          },
        ],
        owner: { 
          type: Schema.Types.ObjectId, 
          required: true, 
          refPath: "ownerModel"
        },
        ownerModel: {
          type: String,
          required: true,
          enum: ["User", "Admin"],
        },
        areYouTheOwner: { type: Boolean, required: true },
        features: [{ type: String }],
        leaseHold: { type: String },
        tenantCriteria: [{ type: String }],
        rentalConditions: {
          conditions: [{ type: String }],
          tenantGenderPreference: { type: String },
        },
        additionalFeatures: {
          noOfBedroom: { type: Number, default: 0 },
          noOfBathroom: { type: Number, default: 0 },
          noOfToilet: { type: Number, default: 0 },
          noOfCarPark: { type: Number, default: 0 },
        },
        jvConditions: [{ type: String }],
        shortletDetails: {
          streetAddress: { type: String },
          maxGuests: { type: Number },
          availability: {
            minStay: { type: Number },
          },
          pricing: {
            nightly: { type: Number, default: 0 },
            weeklyDiscount: { type: Number, default: 0 },
            monthlyDiscount: { type: Number, default: 0 },
            cleaningFee: { type: Number, default: 0 },
            securityDeposit: { type: Number, default: 0 },
          },
          houseRules: {
            checkIn: { type: String },
            checkOut: { type: String },
            smoking: { type: Boolean, default: false },
            pets: { type: Boolean, default: false },
            parties: { type: Boolean, default: false },
            otherRules: { type: String },
          },
          cancellationPolicy: { type: String },
        },
        pictures: [{ type: String }],
        videos: [{ type: String }],
        description: { type: String },
        addtionalInfo: { type: String },
        isTenanted: { type: String, enum: ["yes", "no", "i-live-in-it"], default: "no" },
        isAvailable: { type: Boolean, default: false },
        status: {
          type: String,
          enum: [
            "rejected",
            "approved",
            "pending",
            "deleted",
            "available",
            "unavailable",
            "flagged",
            "sold",
            "active",
            "contingent",
            "under_contract",
            "coming_soon",
            "expired",
            "withdrawn",
            "cancelled",
            "back_on_market",
            "temporarily_off_market",
            "hold",
            "failed",
            "never_listed",
            "booked"
          ],
          default: "pending",
          required: true,
        },
        reason: { type: String },
        employmentType: { type: String },
        tenantGenderPreferences: { type: String },
        briefType: { type: String },
        isPremium: { type: Boolean, default: false },
        isApproved: { type: Boolean, default: false },
        isRejected: { type: Boolean, default: false },
        isDeleted: { type: Boolean, default: false },
        createdByRole: {
          type: String,
          enum: ["user", "admin"],
          required: true,
        },
        bookedPeriods: {
          type: [
            {
              bookingId: { type: Schema.Types.ObjectId, ref: "Booking" },
              checkInDateTime: { type: Date, default: null },
              checkOutDateTime: { type: Date, default: null },
            },
          ],
          default: [],
        },
      },
      { timestamps: true },
    );
 
    this.propertyModel = model<IPropertyDoc>("Property", schema);
  }

  public get model(): Model<IPropertyDoc> {
    return this.propertyModel;
  }
}
