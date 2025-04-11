import { generalTemplate, generatePropertySellBriefEmail, PropertyReceivedTemplate } from '../../common/email.template';
import HttpStatusCodes from '../../common/HttpStatusCodes';
import { RouteError } from '../../common/classes';
import { IPropertySell } from '../../models/index';
import { DB } from '../index';
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
  landSize?: {
    measurementType: string;
    size: number;
  };
}

export interface IPropertySellController {
  all: (
    page: number,
    limit: number,
    ownerModel: string
  ) => Promise<{ data: IPropertySell[]; total: number; currentPage: number }>;
  getOne: (_id: string) => Promise<IPropertySell | null>;
  add: (PropertySell: PropertySellProps) => Promise<IPropertySell>;
  update: (_id: string, PropertySell: PropertySellProps) => Promise<IPropertySell>;
  delete: (_id: string, ownerType?: string) => Promise<void>;
}

export class PropertySellController implements IPropertySellController {
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
    limit: number,
    ownerModel?: string
  ): Promise<{ data: IPropertySell[]; total: number; currentPage: number }> {
    try {
      if (page < 1 || limit < 1) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid page or limit');
      }
      const skip = (page - 1) * limit;
      if (ownerModel) {
        const data = await DB.Models.PropertySell.find({ ownerModel })
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 })
          .exec();
        return {
          data,
          total: await DB.Models.PropertySell.find({ ownerModel }).countDocuments({}),
          currentPage: page,
        };
      } else {
        const data = await DB.Models.PropertySell.find({}).skip(skip).limit(limit).sort({ createdAt: -1 }).exec();
        return {
          data,
          total: await DB.Models.PropertySell.countDocuments({}),
          currentPage: page,
        };
      }
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
      let owner = await DB.Models.Owner.findOne({ email: PropertySell.owner.email }).exec();
      const agent = await DB.Models.Agent.findOne({ email: PropertySell.owner.email }).exec();

      if (agent) {
        owner = agent as any;
      }

      if (!owner && !agent) {
        owner = await DB.Models.Owner.create({
          ...PropertySell.owner,
          ownerType: 'Seller',
        });
        console.log('owner created', owner);
      } else if (agent && !owner) {
        owner = agent as any;
        PropertySell.isApproved = true;
        console.log('agent found', agent);
      }

      console.log('owner found', owner);
      const newPropertySell = await DB.Models.PropertySell.create({
        ...PropertySell,
        owner: owner._id,
        ownerModel: owner && !agent ? 'PropertyOwner' : 'Agent',
      });
      const mailBody = PropertyReceivedTemplate(PropertySell.owner.fullName, PropertySell);

      const generalMailTemplate = generalTemplate(mailBody);

      const adminEmail = process.env.ADMIN_EMAIL || '';

      await sendEmail({
        to: owner.email,
        subject: 'New Sell Property',
        text: generalMailTemplate,
        html: generalMailTemplate,
      });
      const mailBody1 = generatePropertySellBriefEmail({ ...PropertySell, isAdmin: true });

      await sendEmail({
        to: adminEmail,
        subject: 'New Sell Property',
        text: mailBody1,
        html: mailBody1,
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
  public async update(_id: string, PropertySell: PropertySellProps, user?: any): Promise<any> {
    try {
      const owner =
        (await DB.Models.Agent.findOne({ email: PropertySell.owner.email }).exec()) ||
        (await DB.Models.Owner.findOne({ email: PropertySell.owner.email }).exec());

      if (!owner) throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Owner not found');

      const propert = await DB.Models.PropertySell.findById(_id);

      console.log('propert', propert);
      console.log(user);

      if (propert.ownerModel === 'Agent' && PropertySell.owner.email.toLowerCase() !== user?.email.toLowerCase()) {
        // throw new RouteError(HttpStatusCodes.UNAUTHORIZED, 'Unauthorized, Please login');
        return {
          success: false,
          message: 'Unauthorized, Please login',
        };
      }

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
  public async delete(_id: string, ownerType?: string): Promise<void> {
    try {
      await DB.Models.PropertySell.findByIdAndDelete({ _id, ownerType }).exec();
    } catch (err) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, err.message);
    }
  }
}
