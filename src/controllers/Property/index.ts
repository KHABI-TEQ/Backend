import {
  generalTemplate,
  generatePropertPreferenceBriefEmail,
  generatePropertyBriefEmail,
  generatePropertyPreferenceBriefEmail,
  generatePropertyRentBriefEmail,
  generatePropertySellBriefEmail,
  PropertyReceivedTemplate,
} from "../../common/email.template";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { IProperty, IPropertyDoc } from "../../models/index";
import { DB } from "../index";
import sendEmail from "../../common/send.email";
import { FilterQuery } from "mongoose";

export interface PropertyProps {
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
  additionalInfo?: string;
  isPremium?: boolean;
  preferenceFeeTransaction?: {
    accountName: string;
    transactionReciept: string;
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
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Property Not Found");
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
    filters: {
      location?: string;
      priceRange?: { min?: number; max?: number };
      documentType?: string[];
      bedroom?: number;
      bathroom?: number;
      landSizeType?: string;
      landSize?: number;
      desireFeature?: string[];
      homeCondition?: string;
      tenantCriteria?: string[];
      type?: string;
    } = {},
  ): Promise<{ data: IProperty[]; total: number; currentPage: number }> {
    try {
      const query: any = {
        briefType,
        isPreference: false,
        isApproved: true,
      };

      // Location filter - match string against state, LGA, or area
      if (filters.location) {
        const locationSearch = new RegExp(filters.location, "i");
        query.$or = [
          { "location.state": locationSearch },
          { "location.localGovernment": locationSearch },
          { "location.area": locationSearch },
        ];
      }

      if (filters.priceRange) {
        query.price = {};
        if (filters.priceRange.min !== undefined)
          query.price.$gte = filters.priceRange.min;
        if (filters.priceRange.max !== undefined)
          query.price.$lte = filters.priceRange.max;
      }

      if (filters.documentType?.length) {
        query.docOnProperty = {
          $elemMatch: {
            docName: { $in: filters.documentType },
            isProvided: true,
          },
        };
      }

      if (filters.bedroom !== undefined) {
        query["additionalFeatures.noOfBedrooms"] = filters.bedroom;
      }

      if (filters.bathroom !== undefined) {
        query["additionalFeatures.noOfBathrooms"] = filters.bathroom;
      }

      if (filters.landSizeType) {
        query["landSize.measurementType"] = filters.landSizeType;
      }

      if (filters.landSize !== undefined) {
        query["landSize.size"] = filters.landSize;
      }

      if (filters.desireFeature?.length) {
        query["additionalFeatures.additionalFeatures"] = {
          $all: filters.desireFeature,
        };
      }

      if (filters.homeCondition) {
        query.propertyCondition = filters.homeCondition;
      }

      if (filters.tenantCriteria?.length) {
        query.tenantCriteria = { $all: filters.tenantCriteria };
      }

      if (filters.type) {
        query.propertyType = filters.type;
      }

      const properties = await DB.Models.Property.find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec();

      const total = await DB.Models.Property.countDocuments(query).exec();

      return {
        data: properties,
        total,
        currentPage: page,
      };
    } catch (err: any) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, err.message);
    }
  }

  /**
   *
   * @param Property
   */
  public async add(Property: PropertyProps): Promise<IProperty> {
    try {
      const owner = await DB.Models.User.findOne({
        email: Property.owner.email,
      });

      if (!owner) {
        throw new RouteError(HttpStatusCodes.NOT_FOUND, "Owner not found");
      }

      const newProperty = await DB.Models.Property.create({
        ...Property,
        owner: owner._id,
        isPremium: false,
        isPreference: false,
      });
      const mailBody = generatePropertyBriefEmail(
        Property.owner.fullName,
        Property,
      );

      const generalMailTemplate = generalTemplate(mailBody);

      const adminEmail = process.env.ADMIN_EMAIL || "";

      await sendEmail({
        to: owner.email,
        subject: "New Property",
        text: generalMailTemplate,
        html: generalMailTemplate,
      });
      const mailBody1 = generalTemplate(
        generatePropertySellBriefEmail({ ...Property, isAdmin: true }),
      );

      await sendEmail({
        to: adminEmail,
        subject: "New Property",
        text: mailBody1,
        html: mailBody1,
      });

      return newProperty;
    } catch (err) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, err.message);
    }
  }

  public async getPrefrence(): Promise<any[]> {
    try {
      const prefrence = await DB.Models.Property.find()
        .populate("owner")
        .exec();
      if (prefrence) {
        return prefrence;
      }
    } catch (err) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, err.message);
    }
  }

  public async addPreference(
    Property: PropertyProps & { budgetMax?: number; budgetMin?: number },
  ): Promise<IProperty> {
    try {
      let owner = await DB.Models.User.findOne({ email: Property.owner.email });

      if (!owner) {
        owner = await DB.Models.User.create({
          email: Property.owner.email,
          firstName: Property.owner.fullName.split(" ")[0],
          lastName: Property.owner.fullName.split(" ")[1],
          phoneNumber: Property.owner.phoneNumber,
        });
      }

      const newProperty = await DB.Models.Property.create({
        ...Property,
        owner: owner._id,
        isPreference: true,
        isPremium: false,
        budgetMax: Property.budgetMax || 0,
        budgetMin: Property.budgetMin || 0,
      });
      const mailBody = generatePropertyPreferenceBriefEmail(
        Property.owner.fullName,
        Property,
      );

      const generalMailTemplate = generalTemplate(mailBody);

      const adminEmail = process.env.ADMIN_EMAIL || "";

      await sendEmail({
        to: owner.email,
        subject: "New Property Preference",
        text: generalMailTemplate,
        html: generalMailTemplate,
      });
      const mailBody1 = generalTemplate(
        generatePropertPreferenceBriefEmail({ ...Property }),
      );

      await sendEmail({
        to: adminEmail,
        subject: "New Property Preference",
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
  public async update(
    _id: string,
    Property: PropertyProps,
    user?: any,
  ): Promise<any> {
    try {
      const owner = await DB.Models.User.findOne({
        email: Property.owner.email,
      }).exec();
      if (!owner)
        throw new RouteError(HttpStatusCodes.NOT_FOUND, "Owner not found");

      const property = await DB.Models.Property.findOneAndUpdate(
        { _id },
        { ...Property, owner: owner._id },
        {
          new: true,
        },
      ).exec();

      if (!property)
        throw new RouteError(HttpStatusCodes.NOT_FOUND, "Property not found");
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
    if (query.propertyCondition)
      filter.propertyCondition = query.propertyCondition;
    if (query.briefType) filter.briefType = query.briefType;
    if (query.buildingType) filter.buildingType = query.buildingType;
    if (query.owner) filter.owner = query.owner;
    if (query.isAvailable) filter.isAvailable = query.isAvailable;
    filter.isApproved = true;

    // Location subfields
    if (query.state) filter["location.state"] = query.state;
    if (query.localGovernment)
      filter["location.localGovernment"] = query.localGovernment;
    if (query.area) filter["location.area"] = query.area;

    // Range-based filtering for price and landSize
    if (query.minPrice || query.maxPrice) {
      filter.price = {};
      if (query.minPrice) filter.price.$gte = Number(query.minPrice);
      if (query.maxPrice) filter.price.$lte = Number(query.maxPrice);
    }

    if (query.minLandSize || query.maxLandSize) {
      filter["landSize.size"] = {};
      if (query.minLandSize)
        filter["landSize.size"].$gte = Number(query.minLandSize);
      if (query.maxLandSize)
        filter["landSize.size"].$lte = Number(query.maxLandSize);
    }

    // Array matching
    if (query.features) filter.features = { $all: query.features }; // e.g., ['fenced', 'water']
    if (query.tenantCriteria)
      filter.tenantCriteria = { $all: query.tenantCriteria };
    if (query.additionalFeatures)
      filter["additionalFeatures.additionalFeatures"] = {
        $all: query.additionalFeatures,
      };

    // Numbers in additionalFeatures
    if (query.noOfBedrooms)
      filter["additionalFeatures.noOfBedrooms"] = Number(query.noOfBedrooms);
    if (query.noOfBathrooms)
      filter["additionalFeatures.noOfBathrooms"] = Number(query.noOfBathrooms);
    if (query.noOfToilets)
      filter["additionalFeatures.noOfToilets"] = Number(query.noOfToilets);
    if (query.noOfCarParks)
      filter["additionalFeatures.noOfCarParks"] = Number(query.noOfCarParks);
    if (query.buildingType) filter.buildingType = query.buildingType;
    // filter.isAvailable = true

    return await DB.Models.Property.find(filter);
  }
}
