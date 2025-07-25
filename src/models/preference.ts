import { Schema, model, Model, models, Document, Types } from "mongoose";

// Location Interface
export interface ILocation {
  state: string;
  localGovernmentAreas?: string[];
  lgasWithAreas?: {
    lgaName: string;
    areas: string[];
  }[];
  customLocation?: string;
}

// Budget Interface
export interface IBudget {
  minPrice?: number;
  maxPrice?: number;
  currency: string;
}

// Property Details for Buy & Rent
export interface IPropertyDetails {
  propertyType: string;
  buildingType?: string;
  minBedrooms?: string;
  minBathrooms?: number;
  propertyCondition?: string;
  purpose?: string;
  landSize?: string; // Changed to string to match payload
  measurementUnit?: string; // Changed from measurementType
  documentTypes?: string[]; // Changed from documents
  landConditions?: string[]; // New field
}

// Development Details for Joint-Venture
export interface IDevelopmentDetails {
  minLandSize?: string; // Changed to string to match payload
  measurementUnit?: string; // Changed from measurementType
  jvType?: string;
  propertyType?: string;
  expectedStructureType?: string;
  timeline?: string;
  budgetRange?: string;
  documentTypes?: string[]; // Changed from documents
  landConditions?: string[]; // New field
  buildingType?: string; // Added from payload
  propertyCondition?: string; // Added from payload
  minBedrooms?: string; // Added from payload
  minBathrooms?: number; // Added from payload
  purpose?: string; // Added from payload
}

// Booking Details for Shortlet
export interface IBookingDetails {
  propertyType?: string;
  buildingType?: string;
  minBedrooms?: string;
  minBathrooms?: number;
  numberOfGuests?: number;
  checkInDate?: string;
  checkOutDate?: string;
  travelType?: string;
  preferredCheckInTime?: string;
  preferredCheckOutTime?: string;
  propertyCondition?: string; // Added from payload
  purpose?: string; // Added from payload
  landSize?: string; // Added from payload, changed to string
  measurementUnit?: string; // Added from payload, changed from measurementType
  documentTypes?: string[]; // Added from payload, changed from documents
  landConditions?: string[]; // Added from payload, new field
}

// Features Interface
export interface IFeatures {
  baseFeatures?: string[];
  premiumFeatures?: string[];
  autoAdjustToFeatures: boolean;
}

// Contact Info for Buy & Rent (General)
export interface IGeneralContactInfo {
  fullName: string;
  email: string;
  phoneNumber: string;
}

// Contact Info for Joint-Venture
export interface IJVContactInfo {
  companyName?: string;
  contactPerson: string;
  email: string;
  phoneNumber: string;
  cacRegistrationNumber?: string;
}

// Contact Info for Shortlet
export interface IShortletContactInfo {
  fullName: string;
  email: string;
  phoneNumber: string;
  petsAllowed?: boolean;
  smokingAllowed?: boolean;
  partiesAllowed?: boolean;
  additionalRequests?: string;
  maxBudgetPerNight?: number;
  willingToPayExtra?: boolean;
  cleaningFeeBudget?: number;
  securityDepositBudget?: number;
  cancellationPolicy?: string;
  preferredCheckInTime?: string;
  preferredCheckOutTime?: string;
}

// Union Type for Contact Info to allow flexible storage in schema
export type IContactInfo =
  | IGeneralContactInfo
  | IJVContactInfo
  | IShortletContactInfo;

// --- Main Preference Interface ---
export interface IPreference {
  buyer: Types.ObjectId;

  preferenceType: "buy" | "joint-venture" | "rent" | "shortlet";
  preferenceMode: "buy" | "tenant" | "developer" | "shortlet";

  location: ILocation; // Now uses the ILocation interface and is required
  budget: IBudget; // Now uses the IBudget interface and is required

  propertyDetails?: IPropertyDetails;
  developmentDetails?: IDevelopmentDetails;
  bookingDetails?: IBookingDetails;

  features: IFeatures; // Now uses the IFeatures interface and is required
  contactInfo: IContactInfo; // Now uses the union type IContactInfo and is required

  nearbyLandmark?: string;
  additionalNotes?: string; // Renamed from additionalInfo to align with payloads
  partnerExpectations?: string; // Specific to Joint Venture, optional

  assignedAgent?: Types.ObjectId;
  status: "pending" | "approved" | "matched" | "closed" | "rejected";

  createdAt: Date;
  updatedAt: Date;
}

export interface IPreferenceDoc extends IPreference, Document {}

export type IPreferenceModel = Model<IPreferenceDoc>;

export class Preference {
  private PreferenceModel: IPreferenceModel;

  constructor() {
    const schema = new Schema(
      {
        buyer: { type: Schema.Types.ObjectId, ref: "Buyer", required: true },

        preferenceType: {
          type: String,
          enum: ["buy", "joint-venture", "rent", "shortlet"],
          required: true,
        },

        preferenceMode: {
          type: String,
          enum: ["buy", "developer", "tenant", "shortlet"],
          required: true,
        },

        location: {
          state: { type: String, required: true },
          localGovernmentAreas: [String],
          lgasWithAreas: [
            {
              lgaName: String,
              areas: [String],
            },
          ],
          customLocation: String,
        },

        budget: {
          minPrice: Number,
          maxPrice: Number,
          currency: { type: String, required: true }, // Currency is now required
        },

        propertyDetails: {
          propertyType: String,
          buildingType: String,
          minBedrooms: String,
          minBathrooms: Number,
          propertyCondition: String,
          purpose: String,
          landSize: String, // Stored as string
          measurementUnit: String, // Stored as string
          documentTypes: [String],
          landConditions: [String],
        },

        developmentDetails: {
          minLandSize: String, // Stored as string
          measurementUnit: String, // Stored as string
          jvType: String,
          propertyType: String,
          expectedStructureType: String,
          timeline: String,
          budgetRange: String,
          documentTypes: [String],
          landConditions: [String],
          buildingType: String,
          propertyCondition: String,
          minBedrooms: String,
          minBathrooms: Number,
          purpose: String,
        },

        bookingDetails: {
          propertyType: String,
          buildingType: String,
          minBedrooms: String,
          minBathrooms: Number,
          numberOfGuests: Number,
          checkInDate: String,
          checkOutDate: String,
          travelType: String,
          preferredCheckInTime: String,
          preferredCheckOutTime: String,
          propertyCondition: String,
          purpose: String,
          landSize: String,
          measurementUnit: String,
          documentTypes: [String],
          landConditions: [String],
        },

        features: {
          baseFeatures: [String],
          premiumFeatures: [String],
          autoAdjustToFeatures: { type: Boolean, required: true }, // Required
        },

        contactInfo: {
          fullName: { type: String, required: function(this: any) { // Required for General and Shortlet
            return this.preferenceType === "buy" || this.preferenceType === "rent" || this.preferenceType === "shortlet";
          }},
          contactPerson: { type: String, required: function(this: any) { // Required for JV
            return this.preferenceType === "joint-venture";
          }},
          email: { type: String, required: true },
          phoneNumber: { type: String, required: true },
          companyName: String,
          cacRegistrationNumber: String,
          petsAllowed: { type: Boolean, default: false },
          smokingAllowed: { type: Boolean, default: false },
          partiesAllowed: { type: Boolean, default: false },
          additionalRequests: String,
          maxBudgetPerNight: Number,
          willingToPayExtra: { type: Boolean, default: false },
          cleaningFeeBudget: Number,
          securityDepositBudget: Number,
          cancellationPolicy: String,
          preferredCheckInTime: String,
          preferredCheckOutTime: String,
        },

        nearbyLandmark: String,
        additionalNotes: String, // Renamed from additionalInfo
        partnerExpectations: String, // Specific to Joint Venture

        assignedAgent: { type: Schema.Types.ObjectId, ref: "Agent" },

        status: {
          type: String,
          enum: ["pending", "approved", "matched", "closed", "rejected"],
          default: "pending",
        },
      },
      { timestamps: true },
    );

    // Ensure the model is not recompiled if already exists
    this.PreferenceModel =
      models.Preference || model<IPreferenceDoc>("Preference", schema);
  }

  public get model(): IPreferenceModel {
    return this.PreferenceModel;
  }
}
