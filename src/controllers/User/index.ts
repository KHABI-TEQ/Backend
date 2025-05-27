import { IUser, IUserDoc, IUserModel } from '../../models';
import { DB } from '..';
import { getMimeType, RouteError, signJwt } from '../../common/classes';
import HttpStatusCodes from '../../common/HttpStatusCodes';
import bcrypt from 'bcryptjs';
import { ForgotPasswordVerificationTemplate, generalTemplate, verifyEmailTemplate } from '../../common/email.template';
import sendEmail from '../../common/send.email';
import { OAuth2Client, TokenPayload } from 'google-auth-library/build/src';
import jwt from 'jsonwebtoken';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID as string);

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

export class UserController {
  private userModel: IUserModel;

  constructor() {
    this.userModel = DB.Models.User;
  }

  public async generateAccountiD(): Promise<string> {
    let randomString = `KT_${Math.random().toString(36).substring(2, 8)}`;
    let isFound = false;

    while (!isFound) {
      const user = await DB.Models.User.findOne({ accountId: randomString }).exec();
      if (user) {
        randomString = Math.random().toString(36).substring(2, 8);
      } else {
        isFound = true;
      }
    }

    return randomString;
  }

  public async signup(
    email: string,
    password: string,
    lastName: string,
    firstName: string,
    phoneNumber: string,
    userType: string
  ): Promise<any> {
    email = email.toLowerCase().trim();
    const checkUser = await DB.Models.User.findOne({ email }).exec();
    if (checkUser) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'User already exists');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const accountId = await this.generateAccountiD();
    const newUser = await DB.Models.User.create({
      email,
      password: passwordHash,
      lastName,
      firstName,
      phoneNumber,
      userType,
      accountId,
      accountApproved: userType === 'Landowners' ? true : false,
      accountStatus: userType === 'Landowners' ? 'active' : 'inactive',
    });
    if (!newUser) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, 'Error creating user');
    }
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

  public async googleSignup(idToken: string, userType: string): Promise<IUser & { token: string }> {
    //GOOGLE AUTHENTICATION
    const verifyUserWithGoogle = await verifyIdToken(idToken);

    if (!verifyUserWithGoogle) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, 'Invalid Google Token');
    }

    const { name, picture } = verifyUserWithGoogle;

    const email = verifyUserWithGoogle?.email?.toLowerCase().trim();

    const userExists = await DB.Models.User.findOne({ email });
    console.log('Checking if user exists');
    if (userExists) {
      throw new RouteError(HttpStatusCodes.CONFLICT, 'User already exists');
    }
    const accountId = await this.generateAccountiD();

    const newUser = await DB.Models.User.create({
      email,
      fullName: name,
      profile_picture: picture,
      isAccountVerified: true,
      accountId,
      userType,
      accountApproved: userType === 'Landowners' ? true : false,
      accountStatus: userType === 'Landowners' ? 'active' : 'inactive',
    });

    const token = signJwt({ email: newUser.email, id: newUser._id });

    return { ...newUser.toObject(), token };
  }

  public async googleLogin(idToken: string): Promise<any> {
    //GOOGLE AUTHENTICATION
    const verifyUserWithGoogle = await verifyIdToken(idToken);

    if (!verifyUserWithGoogle) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, 'Invalid Google Token');
    }

    const email = verifyUserWithGoogle?.email?.toLowerCase().trim();

    const user = await DB.Models.User.findOne({ email });
    if (!user) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'User not found');

    const payload = {
      email: user.email,
      userType: user?.userType,
      id: user._id,
    };

    const token = signJwt(payload);
    const { password, ...newUser } = user.toObject();
    return { ...newUser, token: token };
  }

  public async login(userCreds: { email: string; password: string }): Promise<any> {
    try {
      const { password } = userCreds;

      const email = userCreds.email.toLowerCase().trim();
      const user = await DB.Models.User.findOne({ email });
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
        agentType: user.userType,
        id: user._id,
      };

      user.isAccountInRecovery = false;

      await user.save();

      const token = signJwt(payload);

      if (!user.accountApproved) {
        return { user: user.toObject(), token: token, isAccountApproved: false };
      }

      //   if (ADMINS.includes(user.email)) {
      //     const findAdmin = await DB.Models.Admin.findOne({ email: user.email }).exec();
      //     if (!findAdmin)
      //       await DB.Models.Admin.create({
      //         ...user.toObject(),
      //       });
      //   }
      return { user: user.toObject(), token: token };
    } catch (err) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, err.message);
    }
  }

  public async forgotPasswordResetLink(email: string): Promise<any> {
    try {
      const user = await DB.Models.User.findOne({ email: email.toLowerCase().trim() });
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

  public async changePassword(userData: IUserDoc, oldPassword: string, newPassword: string): Promise<any> {
    try {
      const user = await DB.Models.User.findById(userData._id).exec();
      if (!user) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'userData not found');

      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid Old password');

      const passwordHash = await bcrypt.hash(newPassword, 10);

      await DB.Models.User.findByIdAndUpdate(user._id, { password: passwordHash }).exec();

      return { success: true, message: 'Password changed successfully' };
    } catch (error) {
      console.error(error);
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async updateProfile(
    userData: IUserDoc,
    profileData: {
      firstName?: string;
      lastName?: string;
      phoneNumber?: string;
      address?: {
        street: string;
        state: string;
        localGovtArea: string;
        homeNo: string;
      };
      profilePicture?: string;
    }
  ): Promise<any> {
    try {
      const user = await DB.Models.User.findById(userData._id).exec();
      if (!user) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Agent not found');

      const updatedUser = await DB.Models.Agent.findByIdAndUpdate(
        userData._id,
        { ...profileData },
        { new: true }
      ).exec();

      return updatedUser?.toObject();
    } catch (error) {
      console.error(error);
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }
}
