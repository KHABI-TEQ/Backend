import { Document, model, Model, ObjectId, Schema } from "mongoose";

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
    state: string;
    localGovernment: string;
    area: string;
  };
  landSize?: {
    measurementType?: string;
    size?: number;
  };
  docOnProperty?: {
    docName?: string;
    isProvided?: boolean;
  }[];
  owner: ObjectId; // Can be user or admin
  areYouTheOwner: boolean;
  features?: string[];
  tenantCriteria?: string[];
  additionalFeatures?: {
    noOfBedroom: number;
    noOfBathroom: number;
    noOfToilet: number;
    noOfCarPark: number;
  };
  jvConditions?: string[];
  shortletDetails?: {
    streetAddress?: string;
    maxGuests?: number;
    availability?: { minStay: number };
    pricing: { nightly: number; weeklyDiscount?: number };
    houseRules: { checkIn: string; checkOut: string };
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
    | "never_listed";
  reason?: string;
  briefType: string;
  isPremium: boolean;
  isApproved?: boolean;
  isDeleted?: boolean;
  isRejected?: boolean;
  createdByRole: "user" | "admin"; // Track who created it
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
        owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
        areYouTheOwner: { type: Boolean, required: true },
        features: [{ type: String }],
        tenantCriteria: [{ type: String }],
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
            nightly: { type: Number },
            weeklyDiscount: { type: Number, default: 0 },
          },
          houseRules: {
            checkIn: { type: String },
            checkOut: { type: String },
          },
        },
        pictures: [{ type: String }],
        videos: [{ type: String }],
        description: { type: String },
        addtionalInfo: { type: String },
        isTenanted: { type: String, enum: ["yes", "no", "i-live-in-it"], required: true },
        isAvailable: { type: Boolean, default: false },
        status: {
          type: String,
          enum: [
            "rejected",
            "approved",
            "pending",
            "deleted",
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
      },
      { timestamps: true },
    );
 
    this.propertyModel = model<IPropertyDoc>("Property", schema);
  }

  public get model(): Model<IPropertyDoc> {
    return this.propertyModel;
  }
}
