import path from 'path';
import HttpStatusCodes from '../../common/HttpStatusCodes';
import { RouteError } from '../../common/classes';
import { IPropertyRent } from '../../models/index';
import { DB } from '../index';
import Fuse from 'fuse.js';
import { buyerPropertyRentPreferenceTemplate, propertyRentPreferenceTemplate } from '../../common/email.template';
import sendEmail from '../../common/send.email';

interface PropertyRentProps {
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
  owner: {
    email: string;
    fullName: string;
    phoneNumber: string;
  };
  areYouTheOwner: boolean;
  budgetRange?: string;
  pictures?: string[];
}

interface PropertyRentRequestProps {
  id: string;
  contact: {
    fullName: string;
    phoneNumber: string;
    email: string;
  };
}

interface PropertySearchProps {
  propertyType: string;
  propertyCondition: string;
  state: string;
  localGovernment: string;
  area: string;
  noOfBedrooms: number;

  budgetMin: number;
  budgetMax: number;
  features: string;
  tenantCriteria: string;
  // minLandSize: number;
  // maxLandSize: number;
  landSize: {
    measurementType: string;
    size: number;
  };
}

export interface IBuyerOrRentPropertyRentController {
  all: (page: number, limit: number) => Promise<{ data: IPropertyRent[]; total: number; currentPage: number }>;
  getOne: (_id: string) => Promise<IPropertyRent | null>;
  add: (PropertyRent: PropertyRentProps) => Promise<IPropertyRent>;
  update: (_id: string, PropertyRent: PropertyRentProps) => Promise<IPropertyRent>;
  delete: (_id: string) => Promise<void>;
}

export class BuyerOrRentPropertyRentController implements IBuyerOrRentPropertyRentController {
  /**
   * @param id
   */
  public async getOne(_id: string): Promise<IPropertyRent | null> {
    try {
      const data = await DB.Models.PropertyRent.find({ _id }).exec();
      if (data) {
        return data[0];
      }
      throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Property Not Found');
    } catch (err) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, err.message);
    }
  }

  /**
   *
   */
  public async all(
    page: number,
    limit: number
  ): Promise<{ data: IPropertyRent[]; total: number; currentPage: number }> {
    try {
      const data = await DB.Models.PropertyRent.find({ ownerModel: 'BuyerOrRenter' })
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec();
      const total = await DB.Models.PropertyRent.countDocuments({}).exec();
      return { data, total, currentPage: page };
    } catch (err) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, err.message);
    }
  }

  /**
   *
   * @param PropertyRent
   */
  public async add(PropertyRent: PropertyRentProps): Promise<IPropertyRent> {
    try {
      let owner = await DB.Models.BuyerOrRent.findOne({ email: PropertyRent.owner.email }).exec();
      if (!owner) {
        owner = await DB.Models.BuyerOrRent.create({
          ...PropertyRent.owner,
          ownerType: 'Rent',
        });
      }
      const newPropertyRent = await DB.Models.PropertyRent.create({
        ...PropertyRent,
        owner: owner._id,
        ownerModel: 'BuyerOrRenter',
      });

      const mailBody = propertyRentPreferenceTemplate(PropertyRent);
      const buyerMailBody = buyerPropertyRentPreferenceTemplate(PropertyRent);
      const allAgents = await DB.Models.Agent.find({}).exec();
      allAgents.forEach(async (agent) => {
        await sendEmail({
          to: agent.email,
          subject: 'New Property Rent Request',
          text: mailBody,
          html: mailBody,
        });
      });

      await sendEmail({
        to: process.env.ADMIN_EMAIL,
        subject: 'Property Rent Request',
        text: mailBody,
        html: mailBody,
      });

      await sendEmail({
        to: PropertyRent.owner.email,
        subject: 'Property Rent Request',
        text: buyerMailBody,
        html: buyerMailBody,
      });

      return newPropertyRent;
    } catch (err) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, err.message);
    }
  }

  /**
   * @param PropertyRent
   * @param _id
   */
  public async update(_id: string, PropertyRent: PropertyRentProps): Promise<IPropertyRent> {
    try {
      const owner =
        (await DB.Models.BuyerOrRent.findOne({ email: PropertyRent.owner.email }).exec()) ||
        (await DB.Models.Agent.findOne({ email: PropertyRent.owner.email }).exec());
      if (!owner) throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Owner not found');
      const property = await DB.Models.PropertyRent.findOneAndUpdate(
        { _id },
        { ...PropertyRent, owner: owner._id },
        {
          new: true,
        }
      ).exec();

      if (!property) throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Property not found');

      return property;
    } catch (err) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, err.message);
    }
  }

  /**
   *
   * @param id
   */
  public async delete(_id: string): Promise<void> {
    try {
      await DB.Models.PropertyRent.findByIdAndDelete({ _id }).exec();
    } catch (err) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, err.message);
    }
  }

  /**
   * Fuzzy Searching
   */

  public async getPropertiesFuzzy(PropertySearch: PropertySearchProps) {
    try {
      // const { propertyType, location, budgetMin, budgetMax, features } = PropertySearch;

      // const properties = await DB.Models.PropertyRent.find({
      //   ...(budgetMin || budgetMax
      //     ? { price: { ...(budgetMin ? { $gte: budgetMin } : {}), ...(budgetMax ? { $lte: budgetMax } : {}) } }
      //     : {}),
      // });

      // console.log(properties);

      // const fuse = new Fuse(properties, {
      //   keys: [
      //     'propertyType',
      //     'location.state',
      //     'location.localGovernment',
      //     'location.area',
      //     'propertyFeatures.additionalFeatures',
      //   ],
      //   threshold: 0.4, // Lower means stricter match
      // });

      // console.log(fuse);

      // const results = fuse.search(
      //   `${propertyType} ${location?.state} ${location?.localGovernment} ${location?.area} ${features}`
      // );

      // return results.map((result) => result.item);

      // Match exact property type

      const {
        propertyType,
        propertyCondition,
        state,
        localGovernment,
        area,
        budgetMin,
        budgetMax,
        noOfBedrooms,
        features,
        tenantCriteria,
        // minLandSize,
        // maxLandSize,
        landSize,
      } = PropertySearch;

      const query: any = {};

      if (propertyType) query.propertyType = propertyType;

      // Match exact property condition
      if (propertyCondition) query.propertyCondition = propertyCondition;

      // Match location (state, local government, area)
      if (state) query['location.state'] = state;
      // if (localGovernment) query['location.localGovernment'] = localGovernment;
      // if (area) query['location.area'] = area;

      // Price range filter
      if (budgetMin || budgetMax) {
        query.rentalPrice = {};
        if (budgetMin) query.rentalPrice.$gte = Number(budgetMin);
        if (budgetMax) query.rentalPrice.$lte = Number(budgetMax);
      }

      // Land size filter
      // if (landSize) {
      //   query.landSize = {};
      //   if (landSize.size) query.landSize.size.$gte = Number(landSize.size);
      //   if (landSize.measurementType) query.landSize.measurementType = landSize.measurementType;
      // }

      // Number of bedrooms filter
      if (noOfBedrooms) {
        query.noOfBedrooms = {};
        query.noOfBedrooms.$gte = Number(noOfBedrooms);
      }

      // Features filter (matches if at least one feature exists)
      if (features) {
        const featuresArray = Array.isArray(features) ? features : [features];
        query.features = { $elemMatch: { featureName: { $in: featuresArray } } };
      }

      // Tenant criteria filter
      if (tenantCriteria) {
        const criteriaArray = Array.isArray(tenantCriteria) ? tenantCriteria : [tenantCriteria];
        query.tenantCriteria = { $elemMatch: { criteria: { $in: criteriaArray } } };
      }

      query.isApproved = true;

      // Execute the query
      const properties = await DB.Models.PropertyRent.find(query);

      return properties.filter((property) => property.isAvailable);
    } catch (error) {
      console.error(error);
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async requestProperty(PropertyRent: PropertyRentRequestProps) {
    try {
      const property = await DB.Models.PropertyRent.findOne({ _id: PropertyRent.id }).exec();
      if (!property) throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Property not found');
      if (!property.isAvailable) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Property is not available');
    } catch (error) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }
}
