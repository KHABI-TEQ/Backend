import { Schema, model, Document, Model, ObjectId, Types } from 'mongoose';
import { propertyRent } from '../common/constants';

export interface IPropertyRent {
  propertyType: string;
  propertyCondition: string;
  location: {
    state: string;
    localGovernment: string;
    area: string;
  };
  rentalPrice: number;
  noOfBedrooms: number;
  features: {
    featureName: string;
  }[];

  tenantCriteria: {
    criteria: string;
  }[];
  owner: ObjectId;
  ownerModel: string;
  areYouTheOwner?: boolean;
  isAvailable: string;
  budgetRange?: string;
  pictures?: string[];
  isApproved: boolean;
  isRejected?: boolean;
  // landSize: number;
}

export interface IPropertyRentDoc extends IPropertyRent, Document {}

export type IPropertyRentModel = Model<IPropertyRentDoc>;

export class PropertyRent {
  private propertyRentModel: Model<IPropertyRentDoc>;

  constructor() {
    const schema = new Schema(
      {
        propertyType: {
          type: String,
          required: true,
          //  enum: Object.values(propertyRent.getPropertyType)
        },
        propertyCondition: {
          type: String,
          required: true,
          //  enum: Object.values(propertyRent.getPropertyCondition)
        },
        location: {
          state: { type: String, required: true },
          localGovernment: { type: String, required: true },
          // area: { type: String, required: true },
        },
        rentalPrice: { type: Number, required: true },
        landSize: { type: Number },
        noOfBedrooms: { type: Number },
        features: [
          {
            featureName: {
              type: String,
              required: true,
              // enum: Object.values(propertyRent.getPropertyFeatures)
            },
          },
        ],

        tenantCriteria: [
          {
            criteria: {
              type: String,
              required: true,
              //  enum: Object.values(propertyRent.getTenantCriteria)
            },
          },
        ],

        owner: { type: Types.ObjectId, required: true, refPath: 'ownerModel' },

        ownerModel: {
          type: String,
          required: true,
          enum: ['PropertyOwner', 'Agent', 'BuyerOrRenter'],
        },
        areYouTheOwner: { type: Boolean, default: false },
        isAvailable: { type: Boolean, default: true },
        budgetRange: { type: String },
        pictures: [{ type: String }],
        isApproved: { type: Boolean, default: false },
        isRejected: { type: Boolean, default: false },
      },
      {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
      }
    );

    this.propertyRentModel = model<IPropertyRentDoc>('PropertyRent', schema);
  }

  public get model(): Model<IPropertyRentDoc> {
    return this.propertyRentModel;
  }
}
