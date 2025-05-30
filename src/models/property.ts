import { Document, model, Model, ObjectId, Schema } from 'mongoose';

export interface IProperty {
  propertyType: string;
  propertyCondition: string;
  location: {
    state: string;
    localGovernment: string;
    area: string;
  };
  briefType: string;
  price: number;
  landSize?: {
    measurementType: string;
    size: number;
  };
  features?: string[];
  tenantCriteria?: string[];
  owner: ObjectId; //ref to User
  areYouTheOwner?: boolean;
  isAvailable?: string;
  budgetRange?: string;
  pictures?: string[];
  isApproved?: boolean;
  isRejected?: boolean;
  docOnProperty: {
    docName: string;
    isProvided: boolean;
  }[];
  additionalFeatures: {
    noOfBedrooms: number;
    noOfBathrooms: number;
    noOfToilets: number;
    noOfCarParks: number;
    additionalFeatures: string[];
  };
  buildingType?: string;
  additionalInfo?: string;
  isPreference: boolean;
}

export interface IPropertyDoc extends IProperty, Document {}

export type IPropertyModel = Model<IPropertyDoc>;

export class Property {
  private propertyModel: Model<IPropertyDoc>;

  constructor() {
    const schema = new Schema(
      {
        propertyType: {
          type: String,
        },
        propertyCondition: {
          type: String,
        },
        location: {
          state: { type: String },
          localGovernment: { type: String },
          area: { type: String },
        },
        briefType: { type: String },
        price: { type: Number },
        landSize: {
          measurementType: { type: String },
          size: { type: Number },
        },
        features: [{ type: String }],
        tenantCriteria: [{ type: String }],
        owner: { type: Schema.Types.ObjectId, ref: 'User' }, //ref to User
        areYouTheOwner: { type: Boolean, default: false },
        isAvailable: { type: String, default: 'yes' },
        budgetRange: { type: String },
        pictures: [{ type: String }],
        isApproved: { type: Boolean, default: false },
        isRejected: { type: Boolean, default: false },
        docOnProperty: [
          {
            docName: {
              type: String,
            },
            isProvided: {
              type: Boolean,
              default: false,
            },
          },
        ],
        additionalFeatures: {
          noOfBedrooms: { type: Number },
          noOfBathrooms: { type: Number },
          noOfToilets: { type: Number },
          noOfCarParks: { type: Number },
          additionalFeatures: [{ type: String }],
        },
        buildingType: { type: String },
        additionalInfo: { type: String },
        isPreference: { type: Boolean, default: false },
      },
      {
        timestamps: true,
      }
    );

    this.propertyModel = model<IPropertyDoc>('Property', schema);
  }

  public get model(): Model<IPropertyDoc> {
    return this.propertyModel;
  }
}
