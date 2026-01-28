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
  minLandSize?: string; // New: for SQM range
  maxLandSize?: string; // New: for SQM range
  measurementUnit?: string; // Changed from measurementType
  documentTypes?: string[]; // Changed from documents
  landConditions?: string[]; // New field
}

// Development Details for Joint-Venture
export interface IDevelopmentDetails {
  minLandSize?: string;
  maxLandSize?: string;
  measurementUnit?: string;
  developmentTypes?: ("residential" | "commercial" | "mixed-use" | "industrial")[];
  preferredSharingRatio?: string;
  proposalDetails?: string;
  minimumTitleRequirements?: (
    | "certificate-of-occupancy"
    | "governors-consent"
    | "survey-plan"
    | "deed-of-assignment"
    | "excision"
    | "gazette"
    | "family-receipt"
  )[];
  willingToConsiderPendingTitle?: boolean;
  additionalRequirements?: string;
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
  minLandSize?: string; // New: for SQM range
  maxLandSize?: string; // New: for SQM range
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
  contactPerson?: string;
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

  receiverMode: {
    type?: "general" | "dealSite";
    dealSiteID?: Types.ObjectId;
  };

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
          minLandSize: String, // New: for SQM range
          maxLandSize: String, // New: for SQM range
          measurementUnit: String, // Stored as string
          documentTypes: [String],
          landConditions: [String],
        },

        developmentDetails: {
          minLandSize: { type: String },
          maxLandSize: { type: String },
          measurementUnit: { type: String },
          developmentTypes: {
            type: [String],
            enum: ["residential", "commercial", "mixed-use", "industrial"],
            default: [],
          },
          preferredSharingRatio: { type: String },
          proposalDetails: { type: String },
          minimumTitleRequirements: {
            type: [String],
            enum: [
              "certificate-of-occupancy",
              "governors-consent",
              "survey-plan",
              "deed-of-assignment",
              "excision",
              "gazette",
              "family-receipt",
            ],
            default: [],
          },
          willingToConsiderPendingTitle: { type: Boolean, default: false },
          additionalRequirements: { type: String },
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
          minLandSize: String,
          maxLandSize: String,
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
          contactPerson: { type: String },
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

        receiverMode: {
          type: {
            type: String,
            enum: ["general", "dealSite"],
            default: "general",
          },
          dealSiteID: { type: Schema.Types.ObjectId, ref: "DealSite" }
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
