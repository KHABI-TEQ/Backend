import { Schema, model, models, Document, Model, Types } from "mongoose";
import type {
  PublisherKycStatus,
  PublisherKycUserType,
  DeveloperDimensionStatus,
  DeveloperCompanyType,
} from "../common/kycTypes";

export interface IYouverifySnapshot {
  status?: string;
  retrievedAt?: Date;
  retrievedFields?: string[];
  raw?: Record<string, unknown>;
}

export interface IDeveloperAddressBlock {
  homeNo?: string;
  street?: string;
  localGovtArea?: string;
  state?: string;
}

export interface IDeveloperVerification {
  company?: {
    legalName?: string;
    cacNumber?: string;
    companyType?: DeveloperCompanyType;
    cacCertificateUrls?: string[];
    registeredAddress?: IDeveloperAddressBlock;
    youverify?: IYouverifySnapshot;
    status?: DeveloperDimensionStatus;
    note?: string;
    reviewedAt?: Date;
    reviewedBy?: Types.ObjectId;
  };
  representative?: {
    fullName?: string;
    position?: string;
    phone?: string;
    email?: string;
    idType?: string;
    idNumber?: string;
    idDocumentUrls?: string[];
    youverify?: IYouverifySnapshot;
    status?: DeveloperDimensionStatus;
    note?: string;
    reviewedAt?: Date;
    reviewedBy?: Types.ObjectId;
  };
  address?: IDeveloperAddressBlock & {
    source?: "kyb" | "manual";
    youverify?: IYouverifySnapshot;
    status?: DeveloperDimensionStatus;
    note?: string;
    reviewedAt?: Date;
    reviewedBy?: Types.ObjectId;
  };
}

export interface IPublisherProfile {
  userId: Types.ObjectId;
  userType: PublisherKycUserType;
  address?: {
    street: string;
    homeNo: string;
    state: string;
    localGovtArea: string;
  };
  regionOfOperation?: string[];
  practitionerType?: "Individual" | "Company";
  companyDetails?: {
    companyName?: string;
    cacNumber?: string;
  };
  meansOfId?: {
    name: string;
    docImg: string[];
  }[];
  kycData?: {
    licenseOrRegistrationNumber?: string;
    profileBio?: string;
    specializations?: string[];
    languagesSpoken?: string[];
    servicesOffered?: string[];
    achievements?: {
      title: string;
      description?: string;
      fileUrl?: string;
      dateAwarded?: Date;
    }[];
  };
  kycNote?: string;
  /** Developer-only split verification. Independent of Agent/Landlord kycStatus. */
  verification?: IDeveloperVerification;
  businessPhone?: string;
  businessEmail?: string;
  kycStatus: PublisherKycStatus;
  /** Developer off-plan verification. Independent of basic profile / standard KYC. */
  advancedKycStatus?: PublisherKycStatus;
  advancedKyc?: {
    companyName?: string;
    cacNumber?: string;
    projectName?: string;
    projectLocation?: string;
    projectStage?: string;
    expectedCompletion?: string;
    supportingDocs?: string[];
  };
}

export interface IPublisherProfileDoc extends IPublisherProfile, Document {}
export type IPublisherProfileModel = Model<IPublisherProfileDoc>;

export class PublisherProfile {
  private _model: IPublisherProfileModel;

  constructor() {
    const schema = new Schema<IPublisherProfileDoc>(
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
        userType: {
          type: String,
          enum: ["Agent", "Developer", "Landowners", "PropertyScout"],
          required: true,
        },
        address: {
          street: { type: String },
          homeNo: { type: String },
          state: { type: String },
          localGovtArea: { type: String },
        },
        regionOfOperation: { type: [String], default: [] },
        practitionerType: { type: String, enum: ["Individual", "Company"] },
        companyDetails: {
          companyName: { type: String },
          cacNumber: { type: String },
        },
        meansOfId: [
          {
            name: { type: String },
            docImg: { type: [String] },
          },
        ],
        kycData: {
          licenseOrRegistrationNumber: { type: String },
          profileBio: { type: String },
          specializations: { type: [String], default: [] },
          languagesSpoken: { type: [String], default: [] },
          servicesOffered: { type: [String], default: [] },
          achievements: {
            type: [
              {
                title: { type: String, required: true },
                description: { type: String },
                fileUrl: { type: String },
                dateAwarded: { type: Date },
              },
            ],
            default: [],
          },
        },
        kycNote: { type: String, trim: true },
        businessPhone: { type: String, trim: true },
        businessEmail: { type: String, trim: true },
        verification: {
          company: {
            legalName: { type: String, trim: true },
            cacNumber: { type: String, trim: true },
            companyType: {
              type: String,
              enum: ["business_name", "limited_liability", "other"],
            },
            cacCertificateUrls: { type: [String], default: [] },
            registeredAddress: {
              homeNo: { type: String },
              street: { type: String },
              localGovtArea: { type: String },
              state: { type: String },
            },
            youverify: {
              status: { type: String },
              retrievedAt: { type: Date },
              retrievedFields: { type: [String], default: [] },
              raw: { type: Schema.Types.Mixed },
            },
            status: {
              type: String,
              enum: ["none", "pending", "verified", "requires_attention"],
              default: "none",
            },
            note: { type: String, trim: true },
            reviewedAt: { type: Date },
            reviewedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
          },
          representative: {
            fullName: { type: String, trim: true },
            position: { type: String, trim: true },
            phone: { type: String, trim: true },
            email: { type: String, trim: true },
            idType: { type: String, trim: true },
            idNumber: { type: String, trim: true },
            idDocumentUrls: { type: [String], default: [] },
            youverify: {
              status: { type: String },
              retrievedAt: { type: Date },
              retrievedFields: { type: [String], default: [] },
              raw: { type: Schema.Types.Mixed },
            },
            status: {
              type: String,
              enum: ["none", "pending", "verified", "requires_attention"],
              default: "none",
            },
            note: { type: String, trim: true },
            reviewedAt: { type: Date },
            reviewedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
          },
          address: {
            homeNo: { type: String },
            street: { type: String },
            localGovtArea: { type: String },
            state: { type: String },
            source: { type: String, enum: ["kyb", "manual"] },
            youverify: {
              status: { type: String },
              retrievedAt: { type: Date },
              retrievedFields: { type: [String], default: [] },
              raw: { type: Schema.Types.Mixed },
            },
            status: {
              type: String,
              enum: ["none", "pending", "verified", "requires_attention"],
              default: "none",
            },
            note: { type: String, trim: true },
            reviewedAt: { type: Date },
            reviewedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
          },
        },
        kycStatus: {
          type: String,
          enum: ["none", "pending", "in_review", "approved", "rejected"],
          default: "none",
          index: true,
        },
        advancedKycStatus: {
          type: String,
          enum: ["none", "pending", "in_review", "approved", "rejected"],
          default: "none",
          index: true,
        },
        advancedKyc: {
          companyName: { type: String },
          cacNumber: { type: String },
          projectName: { type: String },
          projectLocation: { type: String },
          projectStage: { type: String },
          expectedCompletion: { type: String },
          supportingDocs: { type: [String], default: [] },
        },
      },
      { timestamps: true }
    );

    this._model =
      (models.PublisherProfile as IPublisherProfileModel) ||
      model<IPublisherProfileDoc>("PublisherProfile", schema);
  }

  public get model(): IPublisherProfileModel {
    return this._model;
  }
}
