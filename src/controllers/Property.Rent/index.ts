import path from 'path';
import HttpStatusCodes from '../../common/HttpStatusCodes';
import { RouteError } from '../../common/classes';
import { IAgentDoc, IPropertyRent } from '../../models/index';
import { DB } from '../index';
import {
  generalTemplate,
  generatePropertyRentBriefEmail,
  PropertyRentReceivedTemplate,
} from '../../common/email.template';
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
  isApproved?: boolean;
}

export interface IPropertyRentController {
  all: (page: number, limit: number) => Promise<{ data: IPropertyRent[]; total: number; currentPage: number }>;
  getOne: (_id: string) => Promise<IPropertyRent | null>;
  add: (PropertyRent: PropertyRentProps) => Promise<IPropertyRent>;
  update: (_id: string, PropertyRent: PropertyRentProps) => Promise<IPropertyRent>;
  delete: (_id: string, ownerModel?: string, user?: IAgentDoc) => Promise<void>;
}

export class PropertyRentController implements IPropertyRentController {
  /**
   * @param id
   */
  public async getOne(_id: string): Promise<IPropertyRent | null> {
    try {
      const data = await DB.Models.PropertyRent.find({ _id, ownerModel: 'PropertyOwner' }).exec();
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
    ownerModel?: string,
    isApproved?: boolean
  ): Promise<{ data: IPropertyRent[]; total: number; currentPage: number }> {
    try {
      if (!ownerModel) {
        const data = await DB.Models.PropertyRent.find({
          isApproved,
          ownerModel: {
            $not: { $eq: 'BuyerOrRenter' },
          },
        })
          .skip((page - 1) * limit)
          .limit(limit)
          .sort({ createdAt: -1 })
          .exec();
        const total = await DB.Models.PropertyRent.countDocuments({
          isApproved,
          ownerModel: {
            $not: { $eq: 'BuyerOrRenter' },
          },
        }).exec();
        return { data, total, currentPage: page };
      } else if (ownerModel === 'all') {
        const data = await DB.Models.PropertyRent.find({
          ownerModel: {
            $not: { $eq: 'BuyerOrRenter' },
          },
        })
          .populate('owner', 'firstName lastName agentType fullName email phoneNumber')
          .skip((page - 1) * limit)
          .limit(limit)
          .sort({ createdAt: -1 })
          .exec();
        const total = await DB.Models.PropertyRent.countDocuments({}).exec();
        return { data, total, currentPage: page };
      }

      console.log(ownerModel, isApproved);

      const data = await DB.Models.PropertyRent.find({ ownerModel })
        .populate('owner', 'firstName lastName agentType fullName email phoneNumber')
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec();
      const total = await DB.Models.PropertyRent.find({ ownerModel }).countDocuments().exec();
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
      let owner = await DB.Models.Owner.findOne({ email: PropertyRent.owner.email }).exec();
      const agent = await DB.Models.Agent.findOne({ email: PropertyRent.owner.email }).exec();

      if (agent) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, "An agent can't upload a property for rent");
      }

      if (!owner) {
        owner = await DB.Models.Owner.create({
          ...PropertyRent.owner,
          ownerType: 'LandLord',
        });
      }
      //  else if (agent && !owner) {
      //   owner = agent as any;
      //   PropertyRent.isApproved = true;
      // }

      const newPropertyRent = await DB.Models.PropertyRent.create({
        ...PropertyRent,
        owner: owner._id,
        ownerModel: 'PropertyOwner',
      });

      const mailBody = generalTemplate(generatePropertyRentBriefEmail({ ...PropertyRent, isAdmin: true }));

      const adminEmail = process.env.ADMIN_EMAIL || '';

      await sendEmail({
        to: adminEmail,
        subject: 'New Property Rent Request',
        text: mailBody,
        html: mailBody,
      });

      const mailBody1 = PropertyRentReceivedTemplate(owner.fullName, PropertyRent);

      const generalTemplate1 = generalTemplate(mailBody1);

      await sendEmail({
        to: owner.email,
        subject: 'New Property Rent',
        text: generalTemplate1,
        html: generalTemplate1,
      });

      return newPropertyRent;
    } catch (err) {
      console.log(err);
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, err.message);
    }
  }

  /**
   * @param PropertyRent
   * @param _id
   */
  public async update(_id: string, PropertyRent: PropertyRentProps, user?: IAgentDoc): Promise<IPropertyRent> {
    try {
      const owner =
        (await DB.Models.Agent.findOne({ email: PropertyRent.owner.email }).exec()) ||
        (await DB.Models.Owner.findOne({ email: PropertyRent.owner.email }).exec());

      if (!owner) throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Owner not found');

      const propert = await DB.Models.PropertyRent.findById(_id);

      if (propert.ownerModel === 'Agent' && PropertyRent.owner?.email.toLowerCase() !== user?.email?.toLowerCase()) {
        throw new RouteError(HttpStatusCodes.UNAUTHORIZED, 'Unauthorized, Please login');
      }

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
  public async delete(_id: string, ownerModel?: string, user?: IAgentDoc): Promise<void> {
    try {
      const property = await DB.Models.PropertyRent.findById(_id).exec();

      let owner;

      if (property.ownerModel === 'Agent') {
        if (String(property?.owner) !== String(user?._id))
          throw new RouteError(HttpStatusCodes.UNAUTHORIZED, 'Unauthorized access, please login');
      }

      await property.delete();
    } catch (err) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, err.message);
    }
  }
}
