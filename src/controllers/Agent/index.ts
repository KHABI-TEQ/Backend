/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextFunction, Request, Response } from 'express';
import { IAgent, IAgentDoc, IPropertyDoc, IUserDoc } from '../../models/index';
import { DB } from '../index';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cloudinary from '../../common/cloudinary';
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
  briefSubmissionAcknowledgementTemplate,
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
      cacNUmber?: string;
    },
    meansOfId: {
      name: string;
      docImg: string[];
    }[],
    govtId: {
      typeOfId: string;
      idNumber: string;
    }
  ) => Promise<any>;

  acctUpgrade: (
    agent: IUserDoc,
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
      cacNUmber?: string;
    },

    meansOfId: {
      name: string;
      docImg: string[];
    }[],
    govtId: {
      typeOfId: string;
      idNumber: string;
    }
  ): Promise<any> {
    email = email.toLowerCase().trim();
    let user = await DB.Models.User.findOne({ email }).exec();

    if (!user) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'User not found');

    const agent = await DB.Models.Agent.findOne({ userId: user._id })
      .populate('userId', 'email firstName lastName phoneNumber _id')
      .exec();

    if (!agent) {
      const newAgent: IAgent = {
        address,
        regionOfOperation,
        agentType,
        companyAgent,
        meansOfId,
        isInActive: false,
        isDeleted: false,
        accountApproved: false,
        accountStatus: 'active',
        isInUpgrade: false,
        isFlagged: false,
        userId: user._id,
        upgradeData: null,
        govtId: {
          typeOfId: govtId.typeOfId,
          idNumber: govtId.idNumber,
        },
      };

      const createdAgent = await DB.Models.Agent.create(newAgent);
    } else {
      const updateAgent = await DB.Models.Agent.findOneAndUpdate(
        { userId: user._id },
        {
          address,
          regionOfOperation,
          agentType,
          companyAgent,
          meansOfId: meansOfId,
          govtId: govtId,
        },
        { new: true }
      );
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
    agent: IUserDoc,
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
      const user = await DB.Models.Agent.findOne({ userId: agent._id }).exec();
      if (!user) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Agent not found');

      const updatedUser = await DB.Models.Agent.findOneAndUpdate(
        { userId: agent._id },
        { ...profileData },
        { new: true }
      ).exec();

      return updatedUser?.toObject();
    } catch (error) {
      console.error(error);
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async acctUpgrade(
    agent: IUserDoc,
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
      const user = await DB.Models.Agent.findOne({ userId: agent._id })
        .populate('userId', 'email firstName lastName phoneNumber _id')
        .exec();
      if (!user) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Agent not found');

      const updatedUser = await DB.Models.Agent.findOneAndUpdate(
        { userId: agent._id },
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

  //============================================================
  public async getMatchingPreferences(agentUser: IUserDoc) {
  const agent = await DB.Models.Agent.findOne({ userId: agentUser._id }).exec();

  if (!agent) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Agent not found');
  }

  const regionOfOperation = agent.regionOfOperation || [];

  let preferences = await DB.Models.Preference.find({
    $or: [
      { 'location.state': { $in: regionOfOperation } },
      { 'location.localGovernment': { $in: regionOfOperation } },
      { 'location.area': { $in: regionOfOperation } },
    ],
  }).populate('buyer').exec();

  // If no preference matches regionOfOperation, fallback to agent's LGA
  if (preferences.length === 0 && agent.address?.localGovtArea) {
    preferences = await DB.Models.Preference.find({
      'location.localGovernment': agent.address.localGovtArea,
    }).populate('buyer').exec();
  }

  return preferences;
}

public async getAllPreferences() {
  
  const preferences = await DB.Models.Preference.find({}).populate('buyer').exec();
  return preferences;
}


// import { briefSubmissionAcknowledgementTemplate, generalTemplate } from '../../common/email.template';

public async createBriefProperty(agentUser: IUserDoc, data: any, files: Express.Multer.File[], preferenceId?: string): Promise<IPropertyDoc> {
  const agent = await DB.Models.Agent.findOne({ userId: agentUser._id.toString()}).populate('userId').exec();
  if (!agent) throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Agent not found');

  data.owner = agentUser._id;

  if (!data.propertyType || !data.location || !data.briefType || !data.price) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Missing required fields');
  }

  // Check if it's a preference brief and validate preferenceId
  const isPreference = data.isPreference === true || data.isPreference === 'true';
  if (isPreference) {
    if (!preferenceId) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'preferenceId is required for preference briefs');
    }

    const preference = await DB.Models.Preference.findById(preferenceId).exec();
    if (!preference) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid preference ID');

    data.preferenceId = preferenceId;
  }

  // Handle file uploads (pictures)
  const pictureUrls: string[] = [];
  if (files && files.length > 0) {
    for (const file of files) {
      const fileBase64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
      const fileName = `brief-${Date.now()}`;
      const uploaded = await cloudinary.uploadFile(fileBase64, fileName, 'brief-pictures');
      pictureUrls.push(uploaded);
    }
  }

  data.pictures = pictureUrls;

  const newProperty = await DB.Models.Property.create(data);

  // Send email notification to the agent
  const emailHtml = generalTemplate(
    briefSubmissionAcknowledgementTemplate(
      (agent.userId as any).firstName,
      {
        propertyType: data.propertyType,
        location: data.location,
        priceRange: data.budgetRange || `${data.budgetMin} - ${data.budgetMax}`,
        briefType: data.briefType,
        features: data.features,
        landSize: data.landSize,
      }
    )
  );

  await sendEmail({
    to: (agent.userId as any).email,
    subject: 'Your Property Brief Submission Was Received',
    html: emailHtml,
    text: emailHtml,
  });

  return newProperty;
}

//========================================================
}
