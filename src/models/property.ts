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
          required: true,
        },
        propertyCondition: {
          type: String,
          required: true,
        },
        location: {
          state: { type: String, required: true },
          localGovernment: { type: String, required: true },
          area: { type: String, required: true },
        },
        briefType: { type: String, required: true },
        price: { type: Number, required: true },
        landSize: {
          measurementType: { type: String, required: true },
          size: { type: Number, required: true },
        },
        features: [{ type: String }],
        tenantCriteria: [{ type: String }],
        owner: { type: Schema.Types.ObjectId, ref: 'User', required: true }, //ref to User
        areYouTheOwner: { type: Boolean, default: false },
        isAvailable: { type: String, default: 'yes' },
        budgetRange: { type: String },
        pictures: [{ type: String }],
        isApproved: { type: Boolean },
        isRejected: { type: Boolean },
        docOnProperty: [
          {
            docName: {
              type: String,
              required: true,
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
