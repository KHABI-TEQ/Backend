import {
  buyerPropertySellPreferenceTemplate,
  generalTemplate,
  propertySellPreferenceTemplate,
} from '../../common/email.template';
import HttpStatusCodes from '../../common/HttpStatusCodes';
import { RouteError } from '../../common/classes';
import { IPropertySell } from '../../models/index';
import { DB } from '../index';
import Fuse from 'fuse.js';
import sendEmail from '../../common/send.email';

interface PropertySellProps {
  propertyType: string;
  location: {
    state: string;
    localGovernment: string;
    area: string;
  };
  price: number;
  docOnProperty: {
    docName: string;
    isProvided: boolean;
  }[];
  propertyFeatures: {
    noOfBedrooms: number;
    additionalFeatures: string[];
  };
  owner: {
    email: string;
    fullName: string;
    phoneNumber: string;
  };
  areYouTheOwner: boolean;
  usageOptions: string[];
  budgetRange?: string;
  pictures?: string[];
  isApproved?: boolean;
}

interface PropertySearchProps {
  propertyType: string;
  state: string;
  localGovernment: string;
  area: string;
  minPrice: number;
  maxPrice: number;
  minBedrooms: number;
  maxBedrooms: number;
  usageOptions: [string];
  additionalFeatures: [string];
  // minLandSize: number;
  // maxLandSize: number;
  lanndSize: {
    measurementType: string;
    size: number;
  };
}

export interface IBuyerOrRentPropertySellController {
  all: (page: number, limit: number) => Promise<{ data: IPropertySell[]; total: number; currentPage: number }>;
  getOne: (_id: string) => Promise<IPropertySell | null>;
  add: (PropertySell: PropertySellProps) => Promise<IPropertySell>;
  update: (_id: string, PropertySell: PropertySellProps) => Promise<IPropertySell>;
  delete: (_id: string) => Promise<void>;
  getPropertiesFuzzySearch: (PropertySearch: PropertySearchProps) => Promise<IPropertySell[]>;
}

export class BuyerOrRentPropertySellController implements IBuyerOrRentPropertySellController {
  /**
   * @param id
   */
  public async getOne(_id: string): Promise<IPropertySell | null> {
    try {
      const data = await DB.Models.PropertySell.find({ _id }).exec();
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
  ): Promise<{ data: IPropertySell[]; total: number; currentPage: number }> {
    try {
      const data = await DB.Models.PropertySell.find({
        ownerModel: 'BuyerOrRenter',
      })
        .populate('owner', 'email phoneNumber fullName')
        .skip((page - 1) * limit)
        .limit(limit)
        .exec();
      const total = await DB.Models.PropertySell.countDocuments({}).exec();
      return { data, total, currentPage: page };
    } catch (err) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, err.message);
    }
  }

  /**
   *
   * @param PropertySell
   */
  public async add(PropertySell: PropertySellProps): Promise<IPropertySell> {
    try {
      let owner = await DB.Models.BuyerOrRent.findOne({ email: PropertySell.owner.email }).exec();
      const agent = await DB.Models.Agent.findOne({ email: PropertySell.owner.email }).exec();
      if (!owner && !agent) {
        owner = await DB.Models.BuyerOrRent.create({
          ...PropertySell.owner,
          ownerType: 'Buyer',
        });
      } else if (agent && !owner) {
        owner = agent as any;
        PropertySell.isApproved = true;
      }
      const newPropertySell = await DB.Models.PropertySell.create({
        ...PropertySell,
        owner: owner._id,
        ownerModel: 'BuyerOrRenter',
      });

      const mailBody = generalTemplate(
        propertySellPreferenceTemplate({ ...PropertySell, fullName: process.env.ADMIN_EMAIL || 'Khabi Teq Admin' })
      );
      const buyerMailBody = generalTemplate(
        buyerPropertySellPreferenceTemplate({ ...PropertySell, fullName: PropertySell.owner.fullName })
      );
      console.log(PropertySell.location.state, 'state');
      const allAgents = await DB.Models.Agent.find({ 'address.state': PropertySell.location.state }).exec();
      allAgents.forEach(async (agent) => {
        await sendEmail({
          to: agent.email,
          subject: 'New Property Sell Request',
          text: mailBody,
          html: mailBody,
        });
      });

      await sendEmail({
        to: process.env.ADMIN_EMAIL,
        subject: 'Property Sell Request',
        text: mailBody,
        html: mailBody,
      });

      await sendEmail({
        to: PropertySell.owner.email,
        subject: 'Property Sell Request',
        text: buyerMailBody,
        html: buyerMailBody,
      });

      return newPropertySell;
    } catch (err) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, err.message);
    }
  }

  /**
   * @param PropertySell
   * @param _id
   */
  public async update(_id: string, PropertySell: PropertySellProps): Promise<IPropertySell> {
    try {
      const owner =
        (await DB.Models.BuyerOrRent.findOne({ email: PropertySell.owner.email }).exec()) ||
        (await DB.Models.Agent.findOne({ email: PropertySell.owner.email }).exec());
      if (!owner) throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Owner not found');
      const property = await DB.Models.PropertySell.findOneAndUpdate(
        { _id },
        { ...PropertySell, owner: owner._id },
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
      await DB.Models.PropertySell.findByIdAndDelete({ _id }).exec();
    } catch (err) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, err.message);
    }
  }

  /**
   * Fuzzy Searching
   */

  public async getPropertiesFuzzySearch(PropertySearch: PropertySearchProps) {
    try {
      const {
        propertyType,

        state,
        localGovernment,
        area,
        minPrice,
        maxPrice,
        minBedrooms,
        maxBedrooms,
        usageOptions,
        additionalFeatures,
        lanndSize,
      } = PropertySearch;

      const query: any = {};

      // Filter by Property Type
      if (propertyType) query.propertyType = propertyType;

      // Filter by Location
      if (state) query['location.state'] = state;
      if (localGovernment) query['location.localGovernment'] = localGovernment;
      // if (area) query['location.area'] = area;

      // Price Range
      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = Number(minPrice);
        if (maxPrice) query.price.$lte = Number(maxPrice);
      }

      // Land Size Range
      if (lanndSize) {
        query['landSize.size'] = {};
        if (lanndSize.size) {
          query['landSize.size'].$gte = Number(lanndSize.size);
        }
        if (lanndSize.measurementType) {
          query['landSize.measurementType'] = lanndSize.measurementType;
        }
      }

      // Number of Bedrooms Range
      if (minBedrooms || maxBedrooms) {
        query['propertyFeatures.noOfBedrooms'] = {};
        if (minBedrooms) query['propertyFeatures.noOfBedrooms'].$gte = Number(minBedrooms);
        if (maxBedrooms) query['propertyFeatures.noOfBedrooms'].$lte = Number(maxBedrooms);
      }

      // Additional Features
      // if (additionalFeatures) query['propertyFeatures.additionalFeatures'] = { $in: additionalFeatures };

      //  // Owner Type
      //  if (ownerModel) query.ownerModel = ownerModel;

      // Availability
      // query.isAvailable = false;
      // Usage

      if (usageOptions) query.usageOptions = { $in: usageOptions };

      query.isApproved = true;

      // Search Properties
      const properties = await DB.Models.PropertySell.find(query).sort({ createdAt: -1 });

      return properties;
    } catch (error) {
      console.error(error);
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }
}
