/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextFunction, Request, Response } from 'express';
import { IAgent, IAgentDoc } from '../../models/index';
import { DB } from '../index';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { otherConstants } from '../../common/constants';
import { getMimeType, RouteError, signJwt } from '../../common/classes';
import HttpStatusCodes from '../../common/HttpStatusCodes';
import validator from '../../common/validator';
import cloudinaryApiUpload from '../../common/cloudinary';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import {
  accountUnderReviewTemplate,
  accountUpgradeTemplate,
  ForgotPasswordVerificationTemplate,
  generalTemplate,
  propertyAvailableTemplate,
  verifyEmailTemplate,
} from '../../common/email.template';
import sendEmail from '../../common/send.email';
import { propertyNotAvailableTemplate } from '../../common/email.template';

const ADMINS = [
  'khabiteqrealty@gmail.com',
  'akanjiabayomi2@gmail.com',
  'abdulsalamasheem@gmail.com',
  'oluwafemiomolounnu@gmail.com',
  'sammiebeechh@gmail.com',
];

// Define an interface for the response

export interface IAgentController {
  onboard: (
    email: string,
    address: {
      street: string;
      // city: string;
      state: string;
      homeNo: string;
      localGovtArea: string;
    },
    regionOfOperation: string[],
    agentType: string,
    companyAgent: {
      companyName?: string;
      regNUmber?: string;
    },
    individualAgent: {
      typeOfId: string;
      // idNumber: string;
    },
    meansOfId: {
      name: string;
      docImg: string[];
    }[]
  ) => Promise<any>;

  acctUpgrade: (
    agent: IAgentDoc,
    upgradeData: {
      companyAgent: {
        companyName: string;
        // regNumber?: string;
      };
      meansOfId: {
        name: string;
        docImg: string[];
      }[];
    }
  ) => Promise<any>;
}

export class AgentController implements IAgentController {
  public async onboard(
    email: string,
    address: {
      street: string;
      // city: string;
      homeNo: string;
      state: string;
      localGovtArea: string;
    },
    regionOfOperation: string[],
    agentType: string,
    companyAgent: {
      companyName?: string;
      // regNUmber?: string;
    },
    individualAgent: {
      typeOfId: string;
      // idNumber: string;
    },
    meansOfId: {
      name: string;
      docImg: string[];
    }[]
  ): Promise<any> {
    email = email.toLowerCase().trim();
    let user = await DB.Models.User.findOne({ email }).exec();

    if (!user) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'User not found');

    const agent = await DB.Models.Agent.findOne({ email })
      .populate('userId', 'email firstName lastName phoneNumber _id')
      .exec();

    if (!agent) {
      const newAgent: IAgent = {
        address,
        regionOfOperation,
        agentType,
        companyAgent,
        individualAgent,
        meansOfId,
        isInActive: false,
        isDeleted: false,
        accountApproved: false,
        accountStatus: 'active',
        isInUpgrade: false,
        isFlagged: false,
        userId: user._id,
        upgradeData: null,
      };

      const createdAgent = await DB.Models.Agent.create(newAgent);
    } else {
      if (agentType === 'Company' && companyAgent) {
        const updateAgent = await DB.Models.Agent.findOneAndUpdate(
          { email },
          {
            address,
            regionOfOperation,
            agentType,
            companyAgent,
            meansOfId: meansOfId,
          },
          { new: true }
        );
      } else if (agentType === 'Individual' && individualAgent) {
        const updateAgent = await DB.Models.Agent.findOneAndUpdate(
          { email },
          {
            address,
            regionOfOperation,
            agentType,
            individualAgent,
            meansOfId: meansOfId,
          },
          { new: true }
        );
      } else {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid agent type');
      }
    }

    // if (user.agentType) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'User already onboarded');

    const body = accountUnderReviewTemplate((user as any)?.firstName || (user as any)?.email);

    const mail = generalTemplate(body);
    await sendEmail({
      to: email,
      subject: 'Your Agent Account is Under Review',
      text: 'Your Agent Account is Under Review',
      html: mail,
    });

    const token = signJwt({
      email: (user as any).email,
      agentType: (user as any).agentType,
      id: (user as any)._id,
    });

    return { ...user.toObject(), token };
  }

  public async confirmPropertyAvailability(requestId: string, isAvailable: boolean): Promise<string> {
    try {
      const propertyRequested = await DB.Models.PropertyRequest.findById(requestId).exec();
      let mailBody, message;

      if (!propertyRequested) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Property request not found');

      const property = await DB.Models[propertyRequested.propertyModel].findById(propertyRequested.propertyId).exec();

      if (!property) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Property not found');

      const requester = await DB.Models.BuyerOrRent.findById(propertyRequested.requestFrom).exec();

      if (!requester) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Requester not found');

      if (!isAvailable) {
        mailBody = propertyNotAvailableTemplate(
          requester.email,
          `${property.location.area}, ${property.location.localGovernment}, ${property.location.state}`
        );

        await DB.Models.PropertyRequest.findByIdAndUpdate(requestId, { status: 'Rejected' }).exec();
        await DB.Models[propertyRequested.propertyModel]
          .updateOne({ _id: propertyRequested.propertyId }, { $set: { isAvailable: false } })
          .exec();

        message = 'Property is not available for inspection';
      } else {
        const encodedData = jwt.sign(
          {
            requestId,
          },
          process.env.JWT_SECRET as string,
          { expiresIn: '3d' }
        );

        const calendlyLink = `${process.env.CLIENT_LINK}/slots?token=${encodedData}`;
        console.log('calendlyLink', calendlyLink);

        mailBody = generalTemplate(
          propertyAvailableTemplate(
            requester.fullName || requester.email,
            `${property.location.area}, ${property.location.localGovernment}, ${property.location.state}`,
            calendlyLink
          )
        );

        await DB.Models.PropertyRequest.findByIdAndUpdate(requestId, { status: 'Accepted' }).exec();
        await DB.Models[propertyRequested.propertyModel]
          .updateOne({ _id: propertyRequested.propertyId }, { $set: { isAvailable: true } })
          .exec();

        message = 'Property is available for inspection';
      }

      await sendEmail({
        to: requester.email,
        subject: 'Schedule Your Property Inspection',
        text: 'Schedule Your Property Inspection',
        html: mailBody,
      });

      return message;
    } catch (error) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async updateProfile(
    agent: IAgentDoc,
    profileData: {
      address?: {
        street: string;
        state: string;
        localGovtArea: string;
        homeNo: string;
      };
      regionOfOperation?: string[];
      profilePicture?: string;
    }
  ): Promise<any> {
    try {
      const user = await DB.Models.Agent.findById(agent._id).exec();
      if (!user) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Agent not found');

      const updatedUser = await DB.Models.Agent.findByIdAndUpdate(agent._id, { ...profileData }, { new: true }).exec();

      return updatedUser?.toObject();
    } catch (error) {
      console.error(error);
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async acctUpgrade(
    agent: IAgentDoc,
    upgradeData: {
      companyAgent: {
        companyName: string;
        // regNumber?: string;
      };
      meansOfId: {
        name: string;
        docImg: string[];
      }[];
    }
  ): Promise<any> {
    try {
      const user = await DB.Models.Agent.findById(agent._id)
        .populate('userId', 'email firstName lastName phoneNumber _id')
        .exec();
      if (!user) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Agent not found');

      const updatedUser = await DB.Models.Agent.findByIdAndUpdate(
        agent._id,
        { isInUpgrade: true, upgradeData: upgradeData },
        { new: true }
      ).exec();

      const body = accountUpgradeTemplate((user.userId as any).firstName || (user.userId as any).email);
      const mail = generalTemplate(body);
      await sendEmail({
        to: (user.userId as any).email,
        subject: 'Account Upgrade Request',
        text: 'Account Upgrade Request',
        html: mail,
      });

      return updatedUser?.toObject();
    } catch (error) {
      console.error(error);
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }
}
