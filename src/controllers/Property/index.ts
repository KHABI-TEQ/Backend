import {
  generalTemplate,
  generatePropertyBriefEmail,
  generatePropertyRentBriefEmail,
  generatePropertySellBriefEmail,
  PropertyReceivedTemplate,
} from '../../common/email.template';
import HttpStatusCodes from '../../common/HttpStatusCodes';
import { RouteError } from '../../common/classes';
import { IProperty, IPropertyDoc } from '../../models/index';
import { DB } from '../index';
import sendEmail from '../../common/send.email';
import { FilterQuery } from 'mongoose';

interface PropertyProps {
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
  owner: {
    email: string;
    fullName: string;
    phoneNumber: string;
  };
}

export class PropertyController {
  /**
   * @param id
   */
  public async getOne(_id: string): Promise<IProperty | null> {
    try {
      const data = await DB.Models.Property.find({ _id }).exec();
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
    limit: number,
    briefType: string,
    isApproved?: boolean
  ): Promise<{ data: IProperty[]; total: number; currentPage: number }> {
    try {
      const properties = await DB.Models.Property.find({
        briefType,
      })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec();
      const total = await DB.Models.Property.countDocuments({ briefType }).exec();

      return {
        data: properties,
        total,
        currentPage: page,
      };
    } catch (err) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, err.message);
    }
  }

  /**
   *
   * @param Property
   */
  public async add(Property: PropertyProps): Promise<IProperty> {
    try {
      const owner = await DB.Models.User.findOne({ email: Property.owner.email });

      if (!owner) {
        throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Owner not found');
      }

      const newProperty = await DB.Models.Property.create({
        ...Property,
        owner: owner._id,
      });
      const mailBody = generatePropertyBriefEmail(Property.owner.fullName, Property);

      const generalMailTemplate = generalTemplate(mailBody);

      const adminEmail = process.env.ADMIN_EMAIL || '';

      await sendEmail({
        to: owner.email,
        subject: 'New Property',
        text: generalMailTemplate,
        html: generalMailTemplate,
      });
      const mailBody1 = generalTemplate(generatePropertySellBriefEmail({ ...Property, isAdmin: true }));

      await sendEmail({
        to: adminEmail,
        subject: 'New Property',
        text: mailBody1,
        html: mailBody1,
      });

      return newProperty;
    } catch (err) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, err.message);
    }
  }

  /**
   * @param Property
   * @param _id
   */
  public async update(_id: string, Property: PropertyProps, user?: any): Promise<any> {
    try {
      const owner = await DB.Models.User.findOne({ email: Property.owner.email }).exec();
      if (!owner) throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Owner not found');

      const property = await DB.Models.Property.findOneAndUpdate(
        { _id },
        { ...Property, owner: owner._id },
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
  public async delete(_id: string, ownerType?: string): Promise<void> {
    try {
      await DB.Models.Property.findByIdAndDelete({ _id, ownerType }).exec();
    } catch (err) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, err.message);
    }
  }

  async searchProperties(query: any) {
    const filter: FilterQuery<IPropertyDoc> = {};

    // Handle simple fields
    if (query.propertyType) filter.propertyType = query.propertyType;
    if (query.propertyCondition) filter.propertyCondition = query.propertyCondition;
    if (query.briefType) filter.briefType = query.briefType;
    if (query.buildingType) filter.buildingType = query.buildingType;
    if (query.owner) filter.owner = query.owner;
    if (query.isAvailable) filter.isAvailable = query.isAvailable;
    if (query.isApproved !== undefined) filter.isApproved = query.isApproved;
    if (query.isRejected !== undefined) filter.isRejected = query.isRejected;

    // Location subfields
    if (query.state) filter['location.state'] = query.state;
    if (query.localGovernment) filter['location.localGovernment'] = query.localGovernment;
    if (query.area) filter['location.area'] = query.area;

    // Range-based filtering for price and landSize
    if (query.minPrice || query.maxPrice) {
      filter.price = {};
      if (query.minPrice) filter.price.$gte = Number(query.minPrice);
      if (query.maxPrice) filter.price.$lte = Number(query.maxPrice);
    }

    if (query.minLandSize || query.maxLandSize) {
      filter['landSize.size'] = {};
      if (query.minLandSize) filter['landSize.size'].$gte = Number(query.minLandSize);
      if (query.maxLandSize) filter['landSize.size'].$lte = Number(query.maxLandSize);
    }

    // Array matching
    if (query.features) filter.features = { $all: query.features }; // e.g., ['fenced', 'water']
    if (query.tenantCriteria) filter.tenantCriteria = { $all: query.tenantCriteria };
    if (query.additionalFeatures)
      filter['additionalFeatures.additionalFeatures'] = {
        $all: query.additionalFeatures,
      };

    // Numbers in additionalFeatures
    if (query.noOfBedrooms) filter['additionalFeatures.noOfBedrooms'] = Number(query.noOfBedrooms);
    if (query.noOfBathrooms) filter['additionalFeatures.noOfBathrooms'] = Number(query.noOfBathrooms);
    if (query.noOfToilets) filter['additionalFeatures.noOfToilets'] = Number(query.noOfToilets);
    if (query.noOfCarParks) filter['additionalFeatures.noOfCarParks'] = Number(query.noOfCarParks);

    return await DB.Models.Property.find(filter);
  }
}
