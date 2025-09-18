import { Schema, model, Document, Model, Types } from "mongoose";

export type DealSiteStatus = "pending" | "on-hold" | "deleted" | "running" | "paused";
export type InspectionStatus = "required" | "optional" | "disabled";
export type FeatureSelectionMode = "auto" | "manual";
export type DefaultTab = "buy" | "rent" | "shortlet" | "jv";
export type DefaultSort = "newest" | "price-asc" | "price-desc";

export interface IDealSite {
  publicSlug: string;
  title: string;
  keywords: string[];
  description: string;
  logoUrl?: string;

  theme?: {
    primaryColor: string;
    secondaryColor: string;
  };

  inspectionSettings?: {
    allowPublicBooking: boolean;
    defaultInspectionFee: number;
    inspectionStatus: InspectionStatus;
    negotiationEnabled: boolean;
  };

  listingsLimit?: number;

  socialLinks?: {
    website?: string;
    twitter?: string;
    instagram?: string;
    facebook?: string;
    linkedin?: string;
  };

  contactVisibility?: {
    showEmail: boolean;
    showPhone: boolean;
    enableContactForm: boolean;
    showWhatsAppButton: boolean;
    whatsappNumber?: string;
  };

  featureSelection?: {
    mode: FeatureSelectionMode;
    propertyIds: string;
  };

  marketplaceDefaults?: {
    defaultTab: DefaultTab;
    defaultSort: DefaultSort;
    showVerifiedOnly: boolean;
    enablePriceNegotiationButton: boolean;
  };

  footerSection?: {
    shortDesc: string;
    copyRight: string;
  };

  publicPage?: {
    heroTitle: string;
    heroSubtitle: string;
    ctaText: string;
    ctaLink: string;
    heroImage: string;
  };

  paymentDetails?: {
    accountNumber: string;
    accountName: string;
    accountBankName: string;
    sortCode: string;
    heroImage: string;
  };

  status: DealSiteStatus;
  createdBy: Types.ObjectId;
}

export interface IDealSiteDoc extends IDealSite, Document {}
export type IDealSiteModel = Model<IDealSiteDoc>;

export class DealSite {
  private dealSiteModel: IDealSiteModel;

  constructor() {
    const schema = new Schema<IDealSiteDoc>(
      {
        publicSlug: { type: String, required: true, unique: true },
        title: { type: String, required: true },
        keywords: { type: [String], default: [] },
        description: { type: String, required: true },
        logoUrl: { type: String },

        theme: {
          primaryColor: { type: String, default: "#09391C" },
          secondaryColor: { type: String, default: "#8DDB90" },
        },

        inspectionSettings: {
          allowPublicBooking: { type: Boolean, default: true },
          defaultInspectionFee: { type: Number, default: 0 },
          inspectionStatus: {
            type: String,
            enum: ["required", "optional", "disabled"],
            default: "optional",
          },
          negotiationEnabled: { type: Boolean, default: true },
        },

        listingsLimit: { type: Number, default: 6 },

        socialLinks: {
          website: String,
          twitter: String,
          instagram: String,
          facebook: String,
          linkedin: String,
        },

        contactVisibility: {
          showEmail: { type: Boolean, default: true },
          showPhone: { type: Boolean, default: true },
          enableContactForm: { type: Boolean, default: true },
          showWhatsAppButton: { type: Boolean, default: false },
          whatsappNumber: { type: String, default: "" },
        },

        featureSelection: {
          mode: { type: String, enum: ["auto", "manual"], default: "auto" },
          propertyIds: { type: String, default: "" },
        },

        marketplaceDefaults: {
          defaultTab: {
            type: String,
            enum: ["buy", "rent", "shortlet", "jv"],
            default: "buy",
          },
          defaultSort: {
            type: String,
            enum: ["newest", "price-asc", "price-desc"],
            default: "newest",
          },
          showVerifiedOnly: { type: Boolean, default: false },
          enablePriceNegotiationButton: { type: Boolean, default: true },
        },
 
        publicPage: {
          heroTitle: { type: String, default: "" },
          heroSubtitle: { type: String, default: "" },
          ctaText: { type: String, default: "" },
          ctaLink: { type: String, default: "" },
          heroImage: { type: String, default: "" },
        },

        footerSection: {
          shortDesc: { type: String, default: "" },
          copyRight: { type: String, default: "" },
        },

        status: { type: String, enum: ["pending", "on-hold", "deleted", "running", "paused"], default: "pending" },

        createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
      },
      { timestamps: true }
    );

    this.dealSiteModel = model<IDealSiteDoc>("DealSite", schema);
  }

  public get model(): IDealSiteModel {
    return this.dealSiteModel;
  }
}
