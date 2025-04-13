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

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID as string);

// Define an interface for the response
interface GoogleUserInfo extends TokenPayload {}

async function verifyIdToken(idToken: string): Promise<GoogleUserInfo | null> {
  // console.log(idToken, process.env.GOOGLE_CLIENT_ID);

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID as string,
    });
    console.log('Ticket:', ticket.getPayload());
    return ticket.getPayload() as GoogleUserInfo;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

export interface IAgentController {
  signup: (
    email: string,
    password: string,
    lastName: string,
    firstName: string,
    phoneNumber: string
  ) => Promise<IAgent>;
  login: (agentCredential: { email: string; password: string }) => Promise<any>;
  forgotPasswordResetLink: (email: string) => Promise<any>;
  resetPassword: (token: string, password: string) => Promise<any>;
  onboard: (
    email: string,
    address: {
      street: string;
      // city: string;
      state: string;
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
    phoneNumber: string,
    lastName: string,
    firstName: string,
    meansOfId: {
      name: string;
      docImg: string[];
    }[]
  ) => Promise<any>;
  uploadImage: (image: any) => Promise<any>;

  googleSignup: (idToken: string) => Promise<IAgent & { token: string }>;
  googleLogin: (idToken: string) => Promise<any>;
  changePassword: (agent: IAgentDoc, oldPassword: string, newPassword: string) => Promise<any>;
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
  public async signup(
    email: string,
    password: string,
    lastName: string,
    firstName: string,
    phoneNumber: string
  ): Promise<any> {
    email = email.toLowerCase().trim();
    const checkUser = await DB.Models.Agent.findOne({ email }).exec();
    if (checkUser) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'User already exists');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await DB.Models.Agent.create({ email, password: passwordHash, lastName, firstName, phoneNumber });

    const token = signJwt({ email: newUser.email });

    const verificationLink = process.env.CLIENT_LINK + '?access_token=' + token;
    const mailBody = verifyEmailTemplate(firstName, verificationLink);
    const mail = generalTemplate(mailBody);

    await sendEmail({
      to: email,
      subject: 'Verify Your Email Address',
      text: 'Verify Your Email Address',
      html: mail,
    });
    return { message: 'Signup successful, please verify your email' };
  }

  public async onboard(
    email: string,
    address: {
      street: string;
      // city: string;
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
    phoneNumber: string,
    lastName: string,
    firstName: string,
    meansOfId: {
      name: string;
      docImg: string[];
    }[]
  ): Promise<any> {
    email = email.toLowerCase().trim();
    let user = await DB.Models.Agent.findOne({ email }).exec();

    if (!user) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'User not found');

    // if (user.agentType) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'User already onboarded');

    if (agentType === 'Company' && companyAgent) {
      user = await DB.Models.Agent.findOneAndUpdate(
        { email },
        {
          address,
          regionOfOperation,
          agentType,
          companyAgent,
          meansOfId: meansOfId,
          phoneNumber,
          lastName,
          firstName,
        },
        { new: true }
      );
    } else if (agentType === 'Individual' && individualAgent) {
      user = await DB.Models.Agent.findOneAndUpdate(
        { email },
        {
          address,
          regionOfOperation,
          agentType,
          individualAgent,
          meansOfId: meansOfId,
          phoneNumber,
          lastName,
          firstName,
        },
        { new: true }
      );
    } else {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid agent type');
    }

    const body = accountUnderReviewTemplate(firstName);

    const mail = generalTemplate(body);
    await sendEmail({
      to: email,
      subject: 'Your Agent Account is Under Review',
      text: 'Your Agent Account is Under Review',
      html: mail,
    });

    const token = signJwt({ email: user.email, agentType: user.agentType, id: user._id });

    return { ...user.toObject(), token };
  }

  public async googleSignup(idToken: string): Promise<IAgent & { token: string }> {
    //GOOGLE AUTHENTICATION
    const verifyUserWithGoogle = await verifyIdToken(idToken);

    if (!verifyUserWithGoogle) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, 'Invalid Google Token');
    }

    const { name, picture } = verifyUserWithGoogle;

    const email = verifyUserWithGoogle?.email?.toLowerCase().trim();

    const userExists = await DB.Models.Agent.findOne({ email });
    console.log('Checking if user exists');
    if (userExists) {
      throw new RouteError(HttpStatusCodes.CONFLICT, 'User already exists');
    }

    const newAgent = await DB.Models.Agent.create({
      email,
      fullName: name,
      profile_picture: picture,
      isAccountVerified: true,
    });

    const token = signJwt({ email: newAgent.email, id: newAgent._id });

    return { ...newAgent.toObject(), token };
  }

  public async googleLogin(idToken: string): Promise<any> {
    //GOOGLE AUTHENTICATION
    const verifyUserWithGoogle = await verifyIdToken(idToken);

    if (!verifyUserWithGoogle) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, 'Invalid Google Token');
    }

    const email = verifyUserWithGoogle?.email?.toLowerCase().trim();

    const user = await DB.Models.Agent.findOne({ email });
    if (!user) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'User not found');

    const payload = {
      email: user.email,
      agentType: user?.agentType,
      id: user._id,
    };

    const token = signJwt(payload);
    const { password, ...newUser } = user.toObject();
    return { ...newUser, token: token };
  }

  public async login(agentCredential: { email: string; password: string }): Promise<any> {
    try {
      const { password } = agentCredential;

      const email = agentCredential.email.toLowerCase().trim();
      const user = await DB.Models.Agent.findOne({ email });
      if (!user) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'User not found');

      if (!user.password) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid Password');

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid password');

      if (!user.isAccountVerified) {
        const token = signJwt({ email: user.email });

        const verificationLink = process.env.CLIENT_LINK + '?access_token=' + token;
        const mailBody = verifyEmailTemplate(user.firstName, verificationLink);
        const mail = generalTemplate(mailBody);

        await sendEmail({
          to: email,
          subject: 'Verify Your Email Address',
          text: 'Verify Your Email Address',
          html: mail,
        });
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Account not verified');
      }

      if (user.isInActive) {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          'Account has been suspended or deactivated, please contact support'
        );
      }

      const payload = {
        email: user.email,
        agentType: user.agentType,
        id: user._id,
      };

      user.isAccountInRecovery = false;

      await user.save();

      const token = signJwt(payload);

      if (!user.accountApproved) {
        return { user: user.toObject(), token: token, isAccountApproved: false };
      }
      return { user: user.toObject(), token: token };
    } catch (err) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, err.message);
    }
  }

  public async forgotPasswordResetLink(email: string): Promise<any> {
    try {
      const user = await DB.Models.Agent.findOne({ email: email.toLowerCase().trim() });
      if (!user) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'User not found');

      const token = signJwt({ email: user.email });

      user.isAccountInRecovery = true;
      await user.save();

      const resetPasswordLink = process.env.CLIENT_LINK + '/agent/auth/reset-password?token=' + token;
      console.log('resetPasswordLink', resetPasswordLink);
      const mailBody = generalTemplate(
        ForgotPasswordVerificationTemplate(user.firstName || user.email, resetPasswordLink)
      );

      await sendEmail({
        to: email,
        subject: 'Reset Password',
        text: 'Reset Password',
        html: mailBody,
      });

      return { success: true, message: 'Reset password link sent to your email' };
    } catch (error) {
      console.error(error);
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async resetPassword(token: string, password: string): Promise<any> {
    try {
      const { email } = jwt.verify(token, process.env.JWT_SECRET as string) as any;
      if (!email) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid token');

      const user = await DB.Models.Agent.findOne({ email });
      if (!user) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'User not found');

      // if (!user.isAccountInRecovery) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid token');

      const passwordHash = await bcrypt.hash(password, 10);

      await DB.Models.Agent.findByIdAndUpdate(user._id, { password: passwordHash, isAccountInRecovery: false }).exec();

      return { success: true, message: 'Password reset successful' };
    } catch (error) {
      console.error(error);
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async uploadImage(image: any): Promise<any> {
    try {
      const fileName = image.file.originalname;
      console.log('fileName', fileName);
      console.log('image', image);

      if (!image) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Image not found');
      const mimeType = getMimeType(image);
      // const base64String = `data:${mimeType};base64,${req?.file?.buffer.toString('base64')}`;
      // const imageUrl = await cloudinaryApiUpload.uploadFile(
      //   base64String,
      //   ,
      //   user.accountType
      // );
    } catch (error) {
      console.log(error);
    }
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

  public async changePassword(agent: IAgentDoc, oldPassword: string, newPassword: string): Promise<any> {
    try {
      const user = await DB.Models.Agent.findById(agent._id).exec();
      if (!user) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Agent not found');

      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid Old password');

      const passwordHash = await bcrypt.hash(newPassword, 10);

      await DB.Models.Agent.findByIdAndUpdate(user._id, { password: passwordHash }).exec();

      return { success: true, message: 'Password changed successfully' };
    } catch (error) {
      console.error(error);
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async updateProfile(
    agent: IAgentDoc,
    profileData: {
      firstName?: string;
      lastName?: string;
      phoneNumber?: string;
      address?: {
        street: string;
        state: string;
        localGovtArea: string;
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
      const user = await DB.Models.Agent.findById(agent._id).exec();
      if (!user) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Agent not found');

      const updatedUser = await DB.Models.Agent.findByIdAndUpdate(
        agent._id,
        { isInUpgrade: true, upgradeData: upgradeData },
        { new: true }
      ).exec();

      const body = accountUpgradeTemplate(user.firstName || user.email);
      const mail = generalTemplate(body);
      await sendEmail({
        to: user.email,
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
