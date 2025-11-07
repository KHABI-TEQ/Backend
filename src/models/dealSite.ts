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
    shortDescription: string;
    copyrightText: string;
  };

  publicPage?: {
    heroTitle: string;
    heroSubtitle: string;
    ctaText: string;
    ctaLink: string;
    heroImageUrl: string;
  };

  about?: {
    hero?: {
      title: string;
      subTitle: string;
      description: string;
      backgroundImage: string;
      backgroundVideo?: string;
      mobileFallbackImage: string;
      overlayColor: string;
      cta: {
        text: string;
        link: string;
        style: string;
      };
    };
    identity?: {
      headline: string;
      content: string;
      keyHighlights: string[];
    };
    missionVision?: {
      title: string;
      items: {
        title: string;
        description: string;
      }[];
      backgroundImage: string;
    };
    values?: {
      title: string;
      description: string;
      items: {
        icon: string;
        title: string;
        description: string;
      }[];
    };
    journey?: {
      title: string;
      timeline: {
        year: string;
        title: string;
        description: string;
      }[];
    };
    leadership?: {
      title: string;
      subTitle: string;
      members: {
        name: string;
        role: string;
        image: string;
        quote: string;
      }[];
    };
    stats?: {
      title: string;
      subTitle: string;
      backgroundColor: string;
      items: {
        label: string;
        value: string;
      }[];
    };
    partners?: {
      title: string;
      subTitle: string;
      logos: string[];
    };
    testimonials?: {
      showFromHome: boolean;
      limit: number;
      title: string;
      layout: "carousel" | "grid";
    };
    cta?: {
      title: string;
      subTitle: string;
      buttonText: string;
      link: string;
      backgroundGradient: string;
    };
  };

  contactUs?: {
    hero?: {
      title: string;
      subTitle: string;
      description: string;
      backgroundImage: string;
      backgroundVideo?: string;
      overlayColor: string;
      cta: {
        text: string;
        link: string;
        style: string;
      };
    };
    contactInfo?: {
      title: string;
      subTitle: string;
      items: {
        icon: string;
        label: string;
        value: string;
      }[];
    };
    mapSection?: {
      title: string;
      subTitle: string;
      locations: {
        city: string;
        address: string;
        coordinates: number[];
      }[];
    };
    cta?: {
      title: string;
      subTitle: string;
      buttonText: string;
      link: string;
      backgroundGradient: string;
    };
    // Legacy fields
    officeHours?: string;
    faqs?: {
      question: string;
      answer: string;
    }[];
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
    readyToFind?: {
      title: string;
      subTitle: string;
      ctas: {
        bgColor: string;
        text: string;
        actionLink: string;
      }[];
      items: {
        icon: string;
        title: string;
        subTitle: string;
        content: string;
      }[];
    };
  };


  subscribeSettings?: {
    title: string;
    subTitle: string;
    miniTitle: string;
    backgroundColor: string;
    cta: {
      text: string;
      color: string;
    };
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
          heroImageUrl: { type: String, default: "" },
        },

        // 🟢 About Section
        about: {
          // Hero Section
          hero: {
            title: { type: String, default: "" },
            subTitle: { type: String, default: "" },
            description: { type: String, default: "" },
            backgroundImage: { type: String, default: "" },
            backgroundVideo: { type: String, default: "" },
            mobileFallbackImage: { type: String, default: "" },
            overlayColor: { type: String, default: "rgba(0, 0, 0, 0.55)" },
            cta: {
              text: { type: String, default: "" },
              link: { type: String, default: "" },
              style: { type: String, default: "light" },
            },
          },

          // Identity Section
          identity: {
            headline: { type: String, default: "" },
            content: { type: String, default: "" },
            keyHighlights: [{ type: String }],
          },

          // Mission & Vision
          missionVision: {
            title: { type: String, default: "" },
            items: [
              {
                title: { type: String },
                description: { type: String },
              },
            ],
            backgroundImage: { type: String, default: "" },
          },

          // Values
          values: {
            title: { type: String, default: "" },
            description: { type: String, default: "" },
            items: [
              {
                icon: { type: String },
                title: { type: String },
                description: { type: String },
              },
            ],
          },

          // Journey/Timeline
          journey: {
            title: { type: String, default: "" },
            timeline: [
              {
                year: { type: String },
                title: { type: String },
                description: { type: String },
              },
            ],
          },

          // Leadership Team
          leadership: {
            title: { type: String, default: "" },
            subTitle: { type: String, default: "" },
            members: [
              {
                name: { type: String },
                role: { type: String },
                image: { type: String },
                quote: { type: String },
              },
            ],
          },

          // Statistics
          stats: {
            title: { type: String, default: "" },
            subTitle: { type: String, default: "" },
            backgroundColor: { type: String, default: "#0B3B2E" },
            items: [
              {
                label: { type: String },
                value: { type: String },
              },
            ],
          },

          // Partners
          partners: {
            title: { type: String, default: "" },
            subTitle: { type: String, default: "" },
            logos: [{ type: String }],
          },

          // Testimonials Configuration
          testimonials: {
            showFromHome: { type: Boolean, default: true },
            limit: { type: Number, default: 3 },
            title: { type: String, default: "" },
            layout: { type: String, enum: ["carousel", "grid"], default: "carousel" },
          },

          // Call to Action
          cta: {
            title: { type: String, default: "" },
            subTitle: { type: String, default: "" },
            buttonText: { type: String, default: "" },
            link: { type: String, default: "" },
            backgroundGradient: { type: String, default: "" },
          },
        },

        // 🟣 Contact Us Section
        contactUs: {
          // Hero Section
          hero: {
            title: { type: String, default: "" },
            subTitle: { type: String, default: "" },
            description: { type: String, default: "" },
            backgroundImage: { type: String, default: "" },
            backgroundVideo: { type: String, default: "" },
            overlayColor: { type: String, default: "rgba(0, 0, 0, 0.45)" },
            cta: {
              text: { type: String, default: "" },
              link: { type: String, default: "" },
              style: { type: String, default: "light" },
            },
          },

          // Contact Information
          contactInfo: {
            title: { type: String, default: "" },
            subTitle: { type: String, default: "" },
            items: [
              {
                icon: { type: String },
                label: { type: String },
                value: { type: String },
              },
            ],
          },

          // Map Section
          mapSection: {
            title: { type: String, default: "" },
            subTitle: { type: String, default: "" },
            locations: [
              {
                city: { type: String },
                address: { type: String },
                coordinates: [{ type: Number }],
              },
            ],
          },

          // Call to Action
          cta: {
            title: { type: String, default: "" },
            subTitle: { type: String, default: "" },
            buttonText: { type: String, default: "" },
            link: { type: String, default: "" },
            backgroundGradient: { type: String, default: "" },
          },

          // Legacy fields (keeping for backward compatibility)
          officeHours: { type: String, default: "" },
          faqs: [
            {
              question: { type: String },
              answer: { type: String },
            },
          ],
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
          readyToFind: {
            title: { type: String, default: "" },
            subTitle: { type: String, default: "" },
            ctas: [
              {
                bgColor: { type: String },
                text: { type: String },
                actionLink: { type: String },
              },
            ],
            items: [
              {
                icon: { type: String },
                title: { type: String },
                subTitle: { type: String },
                content: { type: String },
              },
            ],
          },
        },
 
        subscribeSettings: {
          title: { type: String, default: "" },
          subTitle: { type: String, default: "" },
          miniTitle: { type: String, default: "" },
          backgroundColor: { type: String, default: "#8DDB90" },
          cta: {
            text: { type: String, default: "" },
            color: { type: String, default: "#09391C" },
          },
        },

        footerSection: {
          shortDescription: { type: String, default: "" },
          copyrightText: { type: String, default: "" },
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
