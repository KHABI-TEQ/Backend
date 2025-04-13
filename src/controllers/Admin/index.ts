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
import { RouteError } from '../../common/classes';
import HttpStatusCodes from '../../common/HttpStatusCodes';

export class AdminController {
  private agentController = new AgentController();
  private propertySellController = new PropertySellController();
  private propertyRentController = new PropertyRentController();
  private propertyRentRequestController = new PropertyRequestController();
  private buyerOrRentePropertyController = new BuyerOrRentPropertyRentController();
  private buyerOrRenterPropertySellController = new BuyerOrRentPropertySellController();
  private readonly ownerTypes = ['PropertyOwner', 'BuyerOrRenter', 'Agent'];

  public async getAllUsers() {
    const propertyOwners = await DB.Models.Owner.find().exec();

    const buyerOrRenters = await DB.Models.BuyerOrRent.find().exec();

    const agents = await DB.Models.Agent.find().exec();

    return { propertyOwners, buyerOrRenters, agents };
  }

  public async getProperties(propertyType: string, ownerType: string, page: number, limit: number) {
    if (!this.ownerTypes.includes(ownerType)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid owner type');
    }

    if (propertyType === 'rent') {
      if (ownerType === 'BuyerOrRenter') {
        return await this.buyerOrRentePropertyController.all(page, limit);
      } else {
        return await this.propertyRentController.all(page, limit, ownerType);
      }
    } else {
      if (ownerType === 'BuyerOrRenter') {
        return await this.buyerOrRenterPropertySellController.all(page, limit);
      } else {
        return await this.propertySellController.all(page, limit, ownerType);
      }
    }
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

  public async approveOrDisapproveProperty(propertyType: string, _id: string, status: boolean) {
    let property, owner;
    if (propertyType === 'rent') {
      property = await DB.Models.PropertyRent.findByIdAndUpdate(_id, { isApproved: status }).populate('owner').exec();
    } else {
      property = await DB.Models.PropertySell.findByIdAndUpdate(_id, { isApproved: status }).populate('owner').exec();
    }

    if (!property) throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Property not found');

    const mailBody = PropertyApprovedOrDisapprovedTemplate(
      (property?.owner as any).fullName as any,
      status ? 'approved' : 'disapproved',
      property
    );

    await sendEmail({
      to: (property?.owner as any).email,
      subject: 'Property Approval Status',
      html: mailBody,
      text: mailBody,
    });
  }

  public async deactivateAgent(_id: string, inActiveSatatus: boolean, reason: string) {
    try {
      const agent = await DB.Models.Agent.findByIdAndUpdate(_id, { isInActive: inActiveSatatus }).exec();

      if (!agent) throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Agent not found');

      const rentProperties = await DB.Models.PropertyRent.find({ owner: agent._id }).exec();
      const sellProperties = await DB.Models.PropertySell.find({ owner: agent._id }).exec();

      rentProperties.forEach(async (property) => {
        await DB.Models.PropertyRent.findByIdAndUpdate(property._id, { isApproved: inActiveSatatus }).exec();
      });

      sellProperties.forEach(async (property) => {
        await DB.Models.PropertySell.findByIdAndUpdate(property._id, { isApproved: inActiveSatatus }).exec();
      });

      const mailBody = DeactivateOrActivateAgent(agent.fullName, inActiveSatatus, reason);

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
      const agent = await DB.Models.Agent.findByIdAndDelete(_id).exec();

      if (!agent) throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Agent not found');

      const rentProperties = await DB.Models.PropertyRent.find({ owner: agent._id }).exec();
      const sellProperties = await DB.Models.PropertySell.find({ owner: agent._id }).exec();

      rentProperties.forEach(async (property) => {
        await DB.Models.PropertyRent.findByIdAndDelete(property._id).exec();
      });

      sellProperties.forEach(async (property) => {
        await DB.Models.PropertySell.findByIdAndDelete(property._id).exec();
      });

      const mailBody = DeleteAgent(agent.firstName, reason);

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
      const agent = await DB.Models.Agent.findByIdAndUpdate(_id, { accountApproved: approved }).exec();

      if (!agent) throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Agent not found');

      const body = approved ? accountApproved(agent.firstName) : accountDisaapproved(agent.firstName);

      const subject = approved
        ? 'Welcome to KhabiTeqRealty – Your Partnership Opportunity Awaits!'
        : 'Update on Your KhabiTeqRealty Application';

      const mailBody = generalTemplate(body);

      await sendEmail({
        to: agent.email,
        subject: subject,
        text: mailBody,
        html: mailBody,
      });

      return 'Agent approved';
    } catch (error) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async getAgents(page: number, limit: number, active: boolean) {
    const agents = await DB.Models.Agent.find({ isInActive: active })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();
    const total = await DB.Models.Agent.countDocuments({ isInActive: active }).exec();
    return {
      data: agents,
      total,
      currentPage: page,
    };
  }

  public async approveUpgradeRequest(_id: string, approved: boolean) {
    try {
      const agent = await DB.Models.Agent.findById(_id).exec();
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
        ? accountUpgradeApprovedTemplate(agent.firstName)
        : accountUpgradeDisapprovedTemplate(agent.firstName);
      const mailBody = generalTemplate(body);

      await sendEmail({
        to: agent.email,
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
}
