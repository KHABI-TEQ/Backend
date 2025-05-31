import {
  accountApproved,
  accountDisaapproved,
  accountUpgradeApprovedTemplate,
  accountUpgradeDisapprovedTemplate,
  DeactivateOrActivateAgent,
  DeleteAgent,
  generalTemplate,
  PropertyApprovedOrDisapprovedTemplate,
} from '../../common/email.template';
import { DB } from '..';
import { AgentController } from '../Agent';
import { PropertyRentController } from '../Property.Rent';
import { BuyerOrRentPropertyRentController } from '../Property.Rent.Request';
import { PropertyRequestController } from '../Property.Request';
import { PropertySellController } from '../Property.Sell';
import { BuyerOrRentPropertySellController } from '../Property.Sell.Request';
import sendEmail from '../../common/send.email';
import { RouteError, signJwt, signJwtAdmin } from '../../common/classes';
import HttpStatusCodes from '../../common/HttpStatusCodes';
import bcrypt from 'bcryptjs';

export class AdminController {
  private agentController = new AgentController();
  private propertySellController = new PropertySellController();
  private propertyRentController = new PropertyRentController();
  private propertyRentRequestController = new PropertyRequestController();
  private buyerOrRentePropertyController = new BuyerOrRentPropertyRentController();
  private buyerOrRenterPropertySellController = new BuyerOrRentPropertySellController();
  private readonly ownerTypes = ['PropertyOwner', 'BuyerOrRenter', 'Agent'];

  private readonly defaultPassword = 'KhabiTeqRealty@123';

  public async getAllUsers() {
    const agents = await DB.Models.User.find().exec();

    const users = await Promise.all(
      agents.map(async (agent) => {
        return {
          ...agent.toObject(),
          agentData: await DB.Models.Agent.findOne({ userId: agent._id }).exec(),
        };
      })
    );

    return { users };
  }

  public async groupPropsWithOwner(
    ownerModel: 'PropertySell' | 'PropertyRent',
    ownerType: string,
    page?: number,
    limit?: number
  ) {
    const groupedProperties = await DB.Models[ownerModel].aggregate([
      {
        $lookup: {
          from: ownerType, // or 'agents', 'buyerorrenters', depending on ownerModel
          localField: 'owner',
          foreignField: '_id',
          as: 'ownerDetails',
          pipeline: [
            {
              $project: {
                firstName: 1,
                lastName: 1,
                email: 1,
                fullName: 1,
                phoneNumber: 1,
                agentType: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: '$ownerDetails',
      },
      {
        $group: {
          _id: '$owner',
          ownerInfo: { $first: '$ownerDetails' },
          properties: { $push: '$$ROOT' },
        },
      },
      { $sort: { 'properties.0.createdAt': -1 } },

      // Pagination
      { $skip: (page - 1) * limit },
      { $limit: limit },

      {
        $project: {
          _id: 0,
          ownerId: '$_id',
          ownerInfo: 1,
          properties: {
            $map: {
              input: '$properties',
              as: 'property',
              in: {
                _id: '$$property._id',
                propertyType: '$$property.propertyType',
                location: '$$property.location',
                price: '$$property.price',
                docOnProperty: '$$property.docOnProperty',
                propertyFeatures: '$$property.propertyFeatures',
                owner: '$$property.owner',
                ownerModel: '$$property.ownerModel',
                areYouTheOwner: '$$property.areYouTheOwner',
                usageOptions: '$$property.usageOptions',
                isAvailable: '$$property.isAvailable',
                budgetRange: '$$property.budgetRange',
                pictures: '$$property.pictures',
                isApproved: '$$property.isApproved',
                isRejected: '$$property.isRejected',
                landSize: '$$property.landSize',
                tenantCriteria: '$$property.tenantCriteria',
                noOfBedrooms: '$$property.noOfBedrooms',
                createdAt: '$$property.createdAt',
                updatedAt: '$$property.updatedAt',
              },
            },
          },
        },
      },
    ]);

    return groupedProperties;
  }

  public async getAllPropertiesWithOwnersGrouped(userType: string, page: number, limit: number) {
    // if (!this.ownerTypes.includes(ownerType)) {
    //   throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid owner type');
    // }
    if (userType === 'seller') {
      return await this.groupPropsWithOwner('PropertySell', 'propertyowners', page, limit);
    } else if (userType === 'landlord') {
      return await this.groupPropsWithOwner('PropertyRent', 'propertyowners', page, limit);
    } else if (userType === 'buyer') {
      const rentPrefencees = await this.groupPropsWithOwner('PropertyRent', 'buyerorrenters', page, limit);
      const sellPreferences = await this.groupPropsWithOwner('PropertySell', 'buyerorrenters', page, limit);

      return { rentPrefencees, sellPreferences };
    } else if (userType === 'agent') {
      return await this.groupPropsWithOwner('PropertySell', 'agents', page, limit);
    } else {
      return [];
    }
  }

  public async getProperties(briefType: string, ownerType: string, page: number, limit: number) {
    if (ownerType === 'all') {
      if (briefType === 'all') {
        const properties = await DB.Models.Property.find({})
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('owner', 'email firstName lastName phoneNumber fullName')
          .sort({ createdAt: -1 })
          .exec();

        const total = await DB.Models.Property.countDocuments({ briefType }).exec();
        return {
          data: properties,
          total,
          currentPage: page,
        };
      } else {
        const properties = await DB.Models.Property.find({ briefType })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('owner', 'email firstName lastName phoneNumber fullName')
          .sort({ createdAt: -1 })
          .exec();

        const total = await DB.Models.Property.countDocuments({ briefType }).exec();
        return {
          data: properties,
          total,
          currentPage: page,
        };
      }
    } else {
      if (briefType === 'all') {
        const properties = await DB.Models.Property.find({ ownerType })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('owner', 'email firstName lastName phoneNumber fullName')
          .sort({ createdAt: -1 })
          .exec();

        const total = await DB.Models.Property.countDocuments({ ownerType }).exec();
        return {
          data: properties,
          total,
          currentPage: page,
        };
      } else {
        const properties = await DB.Models.Property.find({ briefType, ownerType })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('owner', 'email firstName lastName phoneNumber fullName')
          .sort({ createdAt: -1 })
          .exec();

        const total = await DB.Models.Property.countDocuments({ briefType, ownerType }).exec();
        return {
          data: properties,
          total,
          currentPage: page,
        };
      }
    }
    // if (!this.ownerTypes.includes(ownerType)) {
    //   throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid owner type');
    // }

    // if (propertyType === 'rent') {
    //   if (ownerType === 'BuyerOrRenter') {
    //     return await this.buyerOrRentePropertyController.all(page, limit);
    //   } else {
    //     return await this.propertyRentController.all(page, limit, ownerType);
    //   }
    // } else if (propertyType === 'all') {
    //   if (ownerType === 'BuyerOrRenter') {
    //     const propertyRentPreference = await this.buyerOrRentePropertyController.all(page, limit);
    //     const propertySellPreference = await this.buyerOrRenterPropertySellController.all(page, limit);

    //     return {
    //       data: {
    //         rents: propertyRentPreference.data,
    //         sells: propertySellPreference.data,
    //         success: true,
    //         message: 'Properties fetched successfully',
    //       },
    //     };
    //   }
    //   const propertyRent = await this.propertyRentController.all(page, limit, 'all');
    //   const propertySell = await this.propertySellController.all(page, limit, 'all');
    //   return {
    //     data: {
    //       rents: propertyRent.data,
    //       sells: propertySell.data,
    //       success: true,
    //       message: 'Properties fetched successfully',
    //     },
    //   };
    // } else {
    //   if (ownerType === 'BuyerOrRenter') {
    //     return await this.buyerOrRenterPropertySellController.all(page, limit);
    //   } else {
    //     return await this.propertySellController.all(page, limit, ownerType);
    //   }
    // }
  }

  public async deleteProperty(propertyType: string, _id: string, ownerType: string) {
    if (!this.ownerTypes.includes(ownerType)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid owner type');
    }

    if (propertyType === 'rent') {
      if (ownerType === 'BuyerOrRenter') {
        await this.buyerOrRentePropertyController.delete(_id);
      } else {
        await this.propertyRentController.delete(_id, ownerType);
      }
    } else {
      if (ownerType === 'BuyerOrRenter') {
        await this.buyerOrRenterPropertySellController.delete(_id);
      } else {
        await this.propertySellController.delete(_id, ownerType);
      }
    }
  }

  //   public async deletePropertyRequest(propertyType: string, _id: string) {
  //     if (propertyType === 'rent') {
  //       await this.propertyRentRequestController.delete(_id);
  //     } else {
  //       await this.propertyRequestController.delete(_id);
  //     }
  //   }

  public async deletePropByBuyerOrRenter(propertyType: string, _id: string) {
    if (propertyType === 'rent') {
      await this.buyerOrRentePropertyController.delete(_id);
    } else {
      await this.buyerOrRenterPropertySellController.delete(_id);
    }
  }

  public async approveOrDisapproveProperty(_id: string, status: boolean) {
    let property, owner;
    property = await DB.Models.Property.updateOne({ _id }, { isApproved: status }).exec();

    if (!property) throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Property not found');

    property = await DB.Models.Property.findById(_id).populate('owner').exec();

    const mailBody = generalTemplate(
      PropertyApprovedOrDisapprovedTemplate(
        ((property?.owner as any).fullName as any) || (property?.owner as any).firstName,
        status ? 'approved' : 'disapproved',
        property
      )
    );

    await sendEmail({
      to: (property?.owner as any).email,
      subject: 'Property Approval Status',
      html: mailBody,
      text: mailBody,
    });

    return status ? 'Property approved' : 'Property disapproved';
  }

  public async deactivateAgent(_id: string, inActiveSatatus: boolean, reason: string) {
    try {
      const agent = await DB.Models.User.findByIdAndUpdate(_id, {
        isInActive: inActiveSatatus,
        accountApproved: inActiveSatatus,
      }).exec();

      if (!agent) throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Agent not found');

      const properties = await DB.Models.Property.find({ owner: agent._id }).exec();

      properties.length > 0 &&
        properties.forEach(async (property) => {
          await DB.Models.PropertyRent.findByIdAndUpdate(property._id, { isApproved: inActiveSatatus }).exec();
        });

      // sellProperties.forEach(async (property) => {
      //   await DB.Models.PropertySell.findByIdAndUpdate(property._id, { isApproved: inActiveSatatus }).exec();
      // });

      const mailBody = generalTemplate(
        DeactivateOrActivateAgent(agent.firstName || agent.lastName || agent.email, inActiveSatatus, reason)
      );

      await sendEmail({
        to: agent.email,
        subject: inActiveSatatus ? 'Account Deactivated' : 'Account Activated',
        text: mailBody,
        html: mailBody,
      });

      return inActiveSatatus ? 'Agent deactivated' : 'Agent activated';
    } catch (error) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async deleteAgent(_id: string, reason: string) {
    try {
      const agent = await DB.Models.User.findByIdAndDelete(_id).exec();

      if (!agent) throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Agent not found');

      // const rentProperties = await DB.Models.PropertyRent.find({ owner: agent._id }).exec();
      // const sellProperties = await DB.Models.PropertySell.find({ owner: agent._id }).exec();

      // rentProperties.forEach(async (property) => {
      //   await DB.Models.PropertyRent.findByIdAndDelete(property._id).exec();
      // });

      // sellProperties.forEach(async (property) => {
      //   await DB.Models.PropertySell.findByIdAndDelete(property._id).exec();
      // });
      await DB.Models.Agent.findOneAndDelete({ userId: agent._id }).exec();

      const mailBody = generalTemplate(DeleteAgent(agent.firstName, reason));

      await sendEmail({
        to: agent.email,
        subject: 'Account Deleted',
        text: mailBody,
        html: mailBody,
      });

      return 'Agent deleted';
    } catch (error) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async approveAgent(_id: string, approved: boolean) {
    try {
      const userAcct = await DB.Models.User.findByIdAndUpdate(_id, { accountApproved: approved }).exec();

      if (!userAcct) throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Agent not found');

      const agent = await DB.Models.Agent.findOneAndUpdate({ userId: userAcct._id }, { accountApproved: true }).exec();

      const body = approved ? accountApproved(userAcct.firstName) : accountDisaapproved(userAcct.firstName);

      const subject = approved
        ? 'Welcome to KhabiTeqRealty – Your Partnership Opportunity Awaits!'
        : 'Update on Your KhabiTeqRealty Application';

      const mailBody = generalTemplate(body);

      await sendEmail({
        to: userAcct.email,
        subject: subject,
        text: mailBody,
        html: mailBody,
      });

      return 'Agent approved';
    } catch (error) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async getAgents(page: number, limit: number, type: string, userType: string) {
    const totalActiveAgents = await DB.Models.User.countDocuments({
      isInActive: false,
      accountApproved: true,
      userType,
    });
    const totalInactiveAgents = await DB.Models.User.countDocuments({ isInActive: true }).exec();
    const totalAgents = await DB.Models.User.countDocuments({}).exec();
    const totalFlaggedAgents = await DB.Models.User.countDocuments({ isFlagged: true, userType }).exec();

    let agents;

    if (type === 'active') {
      agents = await DB.Models.User.find({ isInActive: false, accountApproved: true, userType })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec();
    } else if (type === 'inactive') {
      agents = await DB.Models.User.find({ isInActive: true, accountApproved: true, userType })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec();
    } else if (type === 'flagged') {
      agents = await DB.Models.User.find({ isFlagged: true, accountApproved: true, userType })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec();
    } else if (type === 'all') {
      agents = await DB.Models.User.find({})
        .skip((page - 1) * limit)
        .limit(limit)
        .exec();
    } else if (type === 'onboarding') {
      agents = await DB.Models.Agent.find({
        agentType: {
          $nin: ['Individual', 'Company'],
        },
      })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'email firstName lastName phoneNumber fullName')
        .exec();
    } else {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid agent type');
    }

    return {
      data: agents,
      totalActiveAgents,
      totalInactiveAgents,
      totalFlaggedAgents,
      totalAgents,
      currentPage: page,
    };
  }

  public async approveUpgradeRequest(_id: string, approved: boolean) {
    try {
      const user = await DB.Models.User.findById(_id).exec();
      if (!user) throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Agent not found');

      const agent = await DB.Models.Agent.findOne({ userId: user._id }).exec();
      if (!agent) throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Agent not found');

      const updateData = approved
        ? {
            isInUpgrade: false,
            upgradeData: {
              companyAgent: agent.upgradeData.companyAgent,
              meansOfId: agent.upgradeData.meansOfId,
              requestDate: agent.upgradeData.requestDate,
              approvedDate: new Date(),
            },
            individualAgent: {
              typeOfId: '',
            },
            companyAgent: agent.upgradeData.companyAgent,
            meansOfId: agent.upgradeData.meansOfId,
          }
        : {
            isInUpgrade: false,
          };

      await DB.Models.Agent.findByIdAndUpdate(_id, updateData).exec();

      const body = approved
        ? accountUpgradeApprovedTemplate(user.firstName)
        : accountUpgradeDisapprovedTemplate(user.firstName);
      const mailBody = generalTemplate(body);

      await sendEmail({
        to: user.email,
        subject: 'Update on Your KhabiTeqRealty Application',
        text: mailBody,
        html: mailBody,
      });

      return approved ? 'Agent upgrade approved' : 'Agent upgrade disapproved';
    } catch (error) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async getPropertyRequests(propertyType: 'PropertySell' | 'PropertyRent', page: number, limit: number) {
    const requests = await DB.Models.PropertyRequest.find({ propertyModel: propertyType })
      .populate('requestFrom')
      .populate({
        path: 'propertyId',
        populate: {
          path: 'owner',
          select: 'email firstName lastName phoneNumber fullName',
        },
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec()
      .then((requests) => {
        return requests.map((request) => {
          const { propertyId, requestFrom, ...otherRequestDetails } = request.toObject();
          return {
            ...otherRequestDetails,
            property: propertyId,
            buyer: requestFrom,
          };
        });
      });

    const total = await DB.Models.PropertyRequest.countDocuments({ propertyModel: propertyType }).exec();
    return {
      data: requests,
      total,
      currentPage: page,
    };
  }

  public async login(adminCred: { email: string; password: string }): Promise<any> {
    try {
      const { password } = adminCred;

      const email = adminCred.email.toLowerCase().trim();
      const admin = await DB.Models.Admin.findOne({ email });
      if (!admin) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Admin not found');

      if (!admin.password) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid Password');

      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid password');

      const payload = {
        email: admin.email,
        role: admin.role,
        id: admin._id,
      };

      admin.isAccountInRecovery = false;

      await admin.save();

      const token = signJwtAdmin(payload);

      return { admin: admin.toObject(), token: token };
    } catch (err) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, err.message);
    }
  }

  public async createAdmin(adminCred: {
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    address: string;
  }) {
    try {
      const { email, firstName, lastName, phoneNumber, address } = adminCred;

      const existingAdmin = await DB.Models.Admin.findOne({ email: email.toLowerCase().trim() }).exec();
      if (existingAdmin) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Admin with this email already exists');
      }

      const hashedPassword = await bcrypt.hash(this.defaultPassword, 10);

      const newAdmin = new DB.Models.Admin({
        email: email.toLowerCase().trim(),
        firstName,
        lastName,
        phoneNumber,
        address,
        password: hashedPassword,
      });

      await newAdmin.save();

      return { message: 'Admin created successfully', admin: newAdmin.toObject() };
    } catch (error) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async changePassword(adminId: string, newPassword: string) {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      const admin = await DB.Models.Admin.findByIdAndUpdate(adminId, {
        password: hashedPassword,
        isVerifed: true,
      }).exec();
      if (!admin) throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Admin not found');

      return { message: 'Password changed successfully' };
    } catch (error) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async updateProperty(propertyId: string, propertyType: string, propertyData: any) {
    try {
      if (propertyType === 'rent') {
        await this.propertyRentController.update(propertyId, propertyData, 'Admin' as any);
      } else if (propertyType === 'sell') {
        await this.propertySellController.update(propertyId, propertyData, 'Admin');
      } else {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid property type');
      }
      return { message: 'Property updated successfully' };
    } catch (error) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }
}
