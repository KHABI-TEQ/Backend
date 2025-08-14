import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { DB } from '..';
import { generateUniqueAccountId, generateUniqueReferralCode } from '../../utils/generateUniqueAccountId';
import HttpStatusCodes from '../../common/HttpStatusCodes';
import { generateToken, RouteError } from '../../common/classes';
import { AppRequest } from '../../types/express';
import { referralService } from '../../services/referral.service';
import { Types } from 'mongoose';

// Initialize Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID!);

// Assuming 'user' is of type IUserDoc (from your models/User.ts)
const sendLoginSuccessResponse = async (user: any, res: Response) => { 
    const token = generateToken({
        id: user._id,
        email: user.email,
        userType: user.userType,
        accountId: user.accountId,
    });

    const userResponse = {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        userType: user.userType,
        isAccountVerified: user.isAccountVerified,
        accountApproved: user.accountApproved,
        isAccountInRecovery: user.isAccountInRecovery,
        address: user.address,
        profile_picture: user.profile_picture,
        isInActive: user.isInActive,
        isDeleted: user.isDeleted,
        accountStatus: user.accountStatus,
        isFlagged: user.isFlagged,
        accountId: user.accountId,
    };

    if (user.userType === 'Agent') {
        const agentData = await DB.Models.Agent.findOne({ userId: user._id });

        const userWithAgent = agentData?.agentType
        ? {
            ...userResponse,
            agentData,
            isAccountApproved: user.accountApproved,
          }
        : userResponse;

        return res.status(HttpStatusCodes.OK).json({
            success: true,
            message: 'Login successful',
            data: {
              token,
              user: userWithAgent,
            }
        });
    }

    return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          user: userResponse,
        }
    });
};

// ✅ GOOGLE AUTH HANDLER
export const googleAuth = async (req: AppRequest, res: Response, next: NextFunction) => {
  const { idToken, userType, referreredCode } = req.body;

  try {
    
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID!,
    });

    const payload = ticket.getPayload();

    if (!payload?.email) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid Google token: Email not found.');
    }

    const { email, given_name, family_name, picture, sub } = payload;
    const normalizedEmail = email.toLowerCase();

    let user = await DB.Models.User.findOne({ email: normalizedEmail });

    if (user) {
      if (!user.googleId) {
        user.googleId = sub;
        await user.save();
      }

      if (!user.isAccountVerified) {
        throw new RouteError(HttpStatusCodes.FORBIDDEN, 'Your account requires email verification.');
      }

      if (
        user.isInActive || user.isDeleted ||
        user.accountStatus === 'inactive' || user.accountStatus === 'deleted'
      ) {
        throw new RouteError(HttpStatusCodes.FORBIDDEN, 'Your account is inactive or has been deleted.');
      }

      return await sendLoginSuccessResponse(user, res);
    }

    let referrerUser = null;
    
    if (referreredCode) {
      referrerUser = await DB.Models.User.findOne({
        referralCode: referreredCode,
        accountStatus: "active",
        isAccountVerified: true,
        isDeleted: false,
      });

      if (!referrerUser) {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          "Invalid or inactive referral code.",
        );
      }
    }

    // No user found: create new one if userType provided
    if (!userType) {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        'Account not found. If you are a new user, please register first, specifying your account type (Landowners or Agent).'
      );
    }

    const accountId = await generateUniqueAccountId();
    const referralCode = await generateUniqueReferralCode();

    const newUser = await DB.Models.User.create({
      email: normalizedEmail,
      firstName: given_name,
      lastName: family_name,
      userType,
      googleId: sub,
      isAccountVerified: true,
      referralCode,
      referredBy: referreredCode,
      accountApproved: userType === 'Agent' ? false : true,
      accountStatus: userType === 'Agent' ? 'inactive' : 'active',
      profile_picture: picture,
      accountId,
      isAccountInRecovery: false,
      isInActive: false,
      isDeleted: false,
      isFlagged: false,
    });

    if (userType === 'Agent') {
      await DB.Models.Agent.create({ userId: newUser._id, accountStatus: 'active' });
    }

    // ✅ Log the referral if valid
    if (referrerUser && newUser) {
      await referralService.createReferralLog({
        referrerId: new Types.ObjectId(referrerUser._id as Types.ObjectId),
        referredUserId: new Types.ObjectId(newUser._id as Types.ObjectId),
        rewardStatus: newUser.userType == "Landowners" ? 'granted' : 'pending',
        rewardType: "registration_bonus",
        triggerAction: "user_signup",
        note: "Referral at account registration",
      });
    }

    return await sendLoginSuccessResponse(newUser, res);

  } catch (err) {
    console.error('Google OAuth Error:', err);
    next(err instanceof RouteError ? err : new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, 'Google login failed'));
  }
};


// ✅ FACEBOOK AUTH HANDLER
export const facebookAuth = async (req: AppRequest, res: Response, next: NextFunction) => {
  const { idToken, userType, referreredCode } = req.body;

  try {
    const fbUrl = `https://graph.facebook.com/me?fields=id,first_name,last_name,email,picture&access_token=${idToken}`;
    const fbRes = await fetch(fbUrl);
    const fbData = await fbRes.json();

    if (fbData.error) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, fbData.error.message || 'Invalid Facebook token.');
    }

    if (!fbData.email) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Facebook email not found.');
    }

    const { id, email, first_name, last_name, picture } = fbData;
    const normalizedEmail = email.toLowerCase();

    let user = await DB.Models.User.findOne({ email: normalizedEmail });

    if (user) {
      if (!user.facebookId) {
        user.facebookId = id;
        await user.save();
      }

      if (!user.isAccountVerified) {
        throw new RouteError(HttpStatusCodes.FORBIDDEN, 'Your account requires email verification.');
      }

      if (
        user.isInActive || user.isDeleted ||
        user.accountStatus === 'inactive' || user.accountStatus === 'deleted'
      ) {
        throw new RouteError(HttpStatusCodes.FORBIDDEN, 'Your account is inactive or has been deleted.');
      }

      return await sendLoginSuccessResponse(user, res);
    }

    let referrerUser = null;
    
    if (referreredCode) {
      referrerUser = await DB.Models.User.findOne({
        referralCode: referreredCode,
        accountStatus: "active",
        isAccountVerified: true,
        isDeleted: false,
      });

      if (!referrerUser) {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          "Invalid or inactive referral code.",
        );
      }
    }

    
    // No user found
    if (!userType) {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        'Account not found. If you are a new user, please register first, specifying your account type (Landowners or Agent).'
      );
    }

    const accountId = await generateUniqueAccountId();
    const referralCode = await generateUniqueReferralCode();

    const newUser = await DB.Models.User.create({
      email: normalizedEmail,
      firstName: first_name,
      lastName: last_name,
      userType,
      facebookId: id,
      isAccountVerified: true,
      referralCode,
      referredBy: referreredCode,
      accountApproved: userType === 'Agent' ? false : true,
      accountStatus: userType === 'Agent' ? 'inactive' : 'active',
      profile_picture: picture?.data?.url || '',
      accountId,
      isAccountInRecovery: false,
      isInActive: false,
      isDeleted: false,
      isFlagged: false,
    });

    if (userType === 'Agent') {
      await DB.Models.Agent.create({ userId: newUser._id, accountStatus: 'active' });
    }

    // ✅ Log the referral if valid
    if (referrerUser && newUser) {
      await referralService.createReferralLog({
        referrerId: new Types.ObjectId(referrerUser._id as Types.ObjectId),
        referredUserId: new Types.ObjectId(newUser._id as Types.ObjectId),
        rewardStatus: newUser.userType == "Landowners" ? 'granted' : 'pending',
        rewardType: "registration_bonus",
        triggerAction: "user_signup",
        note: "Referral at account registration",
      });
    }

    return await sendLoginSuccessResponse(newUser, res);

  } catch (err) {
    console.error('Facebook OAuth Error:', err);
    next(err instanceof RouteError ? err : new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, 'Facebook login failed'));
  }
};
