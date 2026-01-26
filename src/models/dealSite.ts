import { Schema, model, Document, Model, Types } from "mongoose";

export type DealSiteStatus = "pending" | "on-hold" | "deleted" | "running" | "paused";
export type DefaultTab = "buy" | "rent" | "shortlet" | "jv";

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
  publicPage?: {
    heroTitle: string;
    heroSubtitle: string;
    ctaText: string;
    ctaLink: string;
    ctaText2?: string;
    ctaLink2?: string;
    heroImageUrl?: string;
  };
  homeSettings?: {
    testimonials?: {
      title: string;
      subTitle: string;
      testimonials: {
        rating: number;
        description: string;
        image: string;
        name: string;
        company: string;
      }[];
    };
    whyChooseUs?: {
      title: string;
      subTitle: string;
      items: {
        icon: string;
        title: string;
        content: string;
      }[];
    };
  };
  footer?: {
    shortDescription: string;
    copyrightText: string;
  };
  featureSelection?: {
    mode?: "auto" | "manual";
    propertyIds?: string;
    featuredListings?: string[];
  };
  support?: {
    title: string;
    description: string;
    showHeroCtaButtons: boolean;
    supportCards: {
      cardTitle: string;
      cardIcon: string;
      description: string;
      ctaText: string;
      ctaLink: string;
    }[];
  };
  socialLinks?: {
    website?: string;
    twitter?: string;
    instagram?: string;
    facebook?: string;
    linkedin?: string;
  };
  about?: {
    whoWeAre?: {
      title: string;
      description: string;
    };
    ourMission?: {
      title: string;
      description: string;
    };
    ourExperience?: {
      title: string;
      description: string;
    };
    whatWeStandFor?: {
      title: string;
      description: string;
      items?: {
        title: string;
        shortText: string;
      }[];
    };
    whatWeDo?: {
      title: string;
      items?: {
        title: string;
      }[];
    };
    whereWeOperate?: {
      title: string;
      locations?: {
        name: string;
        address?: string;
        coordinates?: [number, number];
      }[];
    };
    profile?: {
      members?: {
        name: string;
        role: string;
        image: string;
        bio: string;
      }[];
    };
  };
  inspectionSettings?: {
    defaultInspectionFee: number;
  };
  contactVisibility?: {
    showEmail: boolean;
    showPhone: boolean;
    enableContactForm: boolean;
    showWhatsAppButton: boolean;
    whatsappNumber?: string;
  };
  contactUs?: {
    title: string;
    description: string;
    location?: {
      name: string;
      address?: string;
      coordinates?: [number, number];
    };
  };
  subscribeSettings?: {
    title: string;
    subTitle: string;
    miniTitle?: string;
    cta?: {
      text?: string;
      color?: string;
    };
    enableEmailSubscription?: boolean;
    subscriptionPlaceholder?: string;
    confirmationMessage?: string;
  };
  paymentDetails?: {
    subAccountCode?: string;
    businessName?: string;
    accountNumber?: string;
    accountName?: string;
    accountBankName?: string;
    primaryContactEmail?: string;
    primaryContactName?: string;
    primaryContactPhone?: string;
    sortCode?: string;
    percentageCharge?: number;
    isVerified?: boolean;
    active?: boolean;
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
        publicPage: {
          heroTitle: { type: String, default: "" },
          heroSubtitle: { type: String, default: "" },
          ctaText: { type: String, default: "" },
          ctaLink: { type: String, default: "" },
          ctaText2: { type: String, default: "" },
          ctaLink2: { type: String, default: "" },
          heroImageUrl: { type: String, default: "" },
        },
        homeSettings: {
          testimonials: {
            title: { type: String, default: "" },
            subTitle: { type: String, default: "" },
            testimonials: [
              {
                rating: { type: Number },
                description: { type: String },
                image: { type: String },
                name: { type: String },
                company: { type: String },
              },
            ],
          },
          whyChooseUs: {
            title: { type: String, default: "" },
            subTitle: { type: String, default: "" },
            items: [
              {
                icon: { type: String },
                title: { type: String },
                content: { type: String },
              },
            ],
          },
        },
        footer: {
          shortDescription: { type: String, default: "" },
          copyrightText: { type: String, default: "" },
        },
        featureSelection: {
          mode: { type: String, enum: ["auto", "manual"], default: "auto" },
          propertyIds: { type: String, default: "" },
          featuredListings: [{ type: String }],
        },
        support: {
          title: { type: String, default: "" },
          description: { type: String, default: "" },
          showHeroCtaButtons: { type: Boolean, default: false },
          supportCards: [
            {
              cardTitle: { type: String },
              cardIcon: { type: String },
              description: { type: String },
              ctaText: { type: String },
              ctaLink: { type: String },
            },
          ],
        },
        socialLinks: {
          website: String,
          twitter: String,
          instagram: String,
          facebook: String,
          linkedin: String,
        },
        // 🟢 About Section
        about: {
          // Who We Are
          whoWeAre: {
            title: { type: String, default: "" },
            description: { type: String, default: "" },
          },

          // Our Mission
          ourMission: {
            title: { type: String, default: "" },
            description: { type: String, default: "" },
          },

          // Our Experience
          ourExperience: {
            title: { type: String, default: "" },
            description: { type: String, default: "" },
          },

          // What We Stand For
          whatWeStandFor: {
            title: { type: String, default: "" },
            description: { type: String, default: "" },
            items: [
              {
                title: { type: String },
                shortText: { type: String },
              },
            ],
          },

          // What We Do
          whatWeDo: {
            title: { type: String, default: "" },
            items: [
              {
                title: { type: String },
              },
            ],
          },

          // Where We Operate
          whereWeOperate: {
            title: { type: String, default: "" },
            locations: [
              {
                name: { type: String },
                address: { type: String },
                coordinates: [{ type: Number }],
              },
            ],
          },

          // Profile / Team Members
          profile: {
            members: [
              {
                name: { type: String },
                role: { type: String },
                image: { type: String },
                bio: { type: String },
              },
            ],
          },
        },
        inspectionSettings: {
          defaultInspectionFee: { type: Number, default: 0 },
        },
        contactVisibility: {
          showEmail: { type: Boolean, default: true },
          showPhone: { type: Boolean, default: true },
          enableContactForm: { type: Boolean, default: true },
          showWhatsAppButton: { type: Boolean, default: false },
          whatsappNumber: { type: String, default: "" },
        },
        // 🟣 Contact Us Section
        contactUs: {
          title: { type: String, default: "" },
          description: { type: String, default: "" },
          location: {
            name: { type: String },
            address: { type: String },
            coordinates: [{ type: Number }],
          },
        },
        subscribeSettings: {
          title: { type: String, default: "" },
          subTitle: { type: String, default: "" },
          miniTitle: { type: String, default: "" },
          cta: {
            text: { type: String, default: "" },
            color: { type: String, default: "" },
          },
          enableEmailSubscription: { type: Boolean, default: true },
          subscriptionPlaceholder: { type: String, default: "Enter your email" },
          confirmationMessage: { type: String, default: "Thank you for subscribing! Check your email for confirmation." },
        },
        paymentDetails: {
          subAccountCode: { type: String },
          accountNumber: { type: String },
          businessName: { type: String },
          accountName: { type: String },
          accountBankName: { type: String },
          primaryContactEmail: { type: String },
          primaryContactPhone: { type: String },
          primaryContactName: { type: String },
          sortCode: { type: String },
          percentageCharge: { type: Number, default: 0 },
          isVerified: { type: Boolean, default: false },
          active: { type: Boolean, default: false },
        },
        status: {
          type: String,
          enum: ["pending", "on-hold", "deleted", "running", "paused"],
          default: "pending",
        },

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
