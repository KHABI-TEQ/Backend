import path from 'path';
import HttpStatusCodes from '../../common/HttpStatusCodes';
import { RouteError } from '../../common/classes';
import { IPropertyRent } from '../../models/index';
import { DB } from '../index';
import { generatePropertyRentBriefEmail } from '../../common/email.template';
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
  delete: (_id: string, ownerModel?: string) => Promise<void>;
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
    ownerModel?: string
  ): Promise<{ data: IPropertyRent[]; total: number; currentPage: number }> {
    try {
      if (!ownerModel) {
        const data = await DB.Models.PropertyRent.find({})
          .skip((page - 1) * limit)
          .limit(limit)
          .sort({ createdAt: -1 })
          .exec();
        const total = await DB.Models.PropertyRent.countDocuments().exec();
        return { data, total, currentPage: page };
      }
      const data = await DB.Models.PropertyRent.find({ ownerModel })
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
      if (!owner && !agent) {
        owner = await DB.Models.Owner.create({
          ...PropertyRent.owner,
          ownerType: 'LandLord',
        });
      } else if (agent && !owner) {
        owner = agent as any;
        PropertyRent.isApproved = true;
      }

      const newPropertyRent = await DB.Models.PropertyRent.create({
        ...PropertyRent,
        owner: owner._id,
        ownerModel: owner && !agent ? 'PropertyOwner' : 'Agent',
      });

      const mailBody = generatePropertyRentBriefEmail({ ...PropertyRent, isAdmin: true });

      const adminEmail = process.env.ADMIN_EMAIL || '';

      await sendEmail({
        to: adminEmail,
        subject: 'New Property Rent Request',
        text: mailBody,
        html: mailBody,
      });

      const mailBody1 = generatePropertyRentBriefEmail({ ...PropertyRent });

      await sendEmail({
        to: owner.email,
        subject: 'New Property Rent Request',
        text: mailBody1,
        html: mailBody1,
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
  public async update(_id: string, PropertyRent: PropertyRentProps): Promise<IPropertyRent> {
    try {
      const owner =
        (await DB.Models.Owner.findOne({ email: PropertyRent.owner.email }).exec()) ||
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
  public async delete(_id: string, ownerModel?: string): Promise<void> {
    try {
      await DB.Models.PropertyRent.findByIdAndDelete({ _id, ownerModel }).exec();
    } catch (err) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, err.message);
    }
  }
}
