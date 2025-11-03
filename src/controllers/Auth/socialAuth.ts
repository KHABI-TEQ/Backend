import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { DB } from '..';
import { generateUniqueAccountId, generateUniqueReferralCode } from '../../utils/generateUniqueAccountId';
import HttpStatusCodes from '../../common/HttpStatusCodes';
import { generateToken, RouteError } from '../../common/classes';
import { AppRequest } from '../../types/express';
import { referralService } from '../../services/referral.service';
import { Types } from 'mongoose';
import { SystemSettingService } from '../../services/systemSetting.service';
import { verifyEmailTemplate } from '../../common/email.template';
import { generalEmailLayout } from '../../common/emailTemplates/emailLayout';
import sendEmail from '../../common/send.email';
import crypto from "crypto";

// Initialize Google OAuth client
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  process.env.GOOGLE_REDIRECT_URI
);

// Helper function to detect if input is authorization code or ID token
const isAuthorizationCode = (token: string): boolean => {
  // Authorization codes typically start with "4/" and are longer
  // ID tokens are JWT format with 3 segments (header.payload.signature)
  return token.startsWith('4/') || token.split('.').length !== 3;
};

// Existing sendLoginSuccessResponse function remains the same
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
    referralCode: user.referralCode,
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

 
const sendVerificationMail = async (newUser: any) => {
  // Generate and send email verification link
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours

  await DB.Models.VerificationToken.create({
    userId: newUser._id,
    token,
    expiresAt,
  });

  const verificationLink = `${process.env.CLIENT_LINK}/auth/verify-account?token=${token}`;
  const mailBody = verifyEmailTemplate(newUser.firstName, verificationLink);
  const html = generalEmailLayout(mailBody);

  await sendEmail({
    to: newUser.email,
    subject: "Verify Your Email Address",
    text: "Verify Your Email Address",
    html,
  });
}

// ✅ UPDATED GOOGLE AUTH HANDLER
export const googleAuth = async (req: AppRequest, res: Response, next: NextFunction) => {
  const { idToken, userType, referreredCode } = req.body;

  try {
    let payload;

    const googleAuthStatus = await SystemSettingService.getSetting("google_auth_enabled");

    if (googleAuthStatus?.value) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Sorry Google Auth is not enabled",
      );
    }

    const googleClientID = process.env.GOOGLE_CLIENT_ID;

    if (isAuthorizationCode(idToken)) {
      // Handle authorization code flow
      try {
        const { tokens } = await googleClient.getToken(idToken);
        console.log('Token exchange successful, received tokens:', Object.keys(tokens));
        
        if (!tokens.id_token) {
          throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'No ID token received from Google.');
        }

        // Verify the ID token we just received
        const ticket = await googleClient.verifyIdToken({
          idToken: tokens.id_token,
          audience: googleClientID!,
        });
        
        payload = ticket.getPayload();
      } catch (tokenError) {
        console.error('Token exchange error details:', {
          error: tokenError.message,
          code: tokenError.code,
          status: tokenError.status
        });
        
        // More specific error handling
        if (tokenError.message?.includes('invalid_grant')) {
          throw new RouteError(
            HttpStatusCodes.BAD_REQUEST, 
            'Invalid authorization code. The code may have expired, already been used, or the redirect URI may not match.'
          );
        }
        throw tokenError;
      }
    } else {
      
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: googleClientID!,
      });
      
      payload = ticket.getPayload();
    }

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
        await sendVerificationMail(user);
        throw new RouteError(HttpStatusCodes.FORBIDDEN, 'Your account is not yet verified. Check your email to complete verification.');
      }

      if (
        user.isInActive ||
        user.isDeleted ||
        user.accountStatus === 'inactive' ||
        user.accountStatus === 'deleted'
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
      accountApproved: true,
      accountStatus: 'active',
      profile_picture: picture,
      accountId,
      isAccountInRecovery: false,
      isInActive: false,
      isDeleted: false,
      isFlagged: false,
    });

    if (userType === 'Agent') {
      await DB.Models.Agent.create({
        userId: newUser._id,
        accountStatus: 'active'
      });
    }

    const referralStatusSettings = await SystemSettingService.getSetting("referral_enabled");
    if (referralStatusSettings?.value) {
      const referralRegisteredPoints = await SystemSettingService.getSetting("referral_register_price");
      // ✅ Log the referral if valid
      if (referrerUser && newUser) {
        await referralService.createReferralLog({
          referrerId: new Types.ObjectId(referrerUser._id as Types.ObjectId),
          referredUserId: new Types.ObjectId(newUser._id as Types.ObjectId),
          rewardType: "registration_bonus",
          triggerAction: "user_signup",
          note: "Referral at account registration",
          rewardStatus: "granted",
          rewardAmount: referralRegisteredPoints?.value || 0
        });
      } 
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
    const facebookAuthStatus = await SystemSettingService.getSetting("facebook_auth_enabled");
    if (facebookAuthStatus?.value) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Sorry Facebook Auth is not enabled",
      );
    }

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
        await sendVerificationMail(user);
        throw new RouteError(HttpStatusCodes.FORBIDDEN, 'Your account is not yet verified. Check your email to complete verification.');
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
      accountApproved: true,
      accountStatus: 'active',
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
    const referralStatusSettings = await SystemSettingService.getSetting("referral_enabled");
    if (referralStatusSettings?.value) {
      const referralRegisteredPoints = await SystemSettingService.getSetting("referral_register_price");
      // ✅ Log the referral if valid
      if (referrerUser && newUser) {
        await referralService.createReferralLog({
          referrerId: new Types.ObjectId(referrerUser._id as Types.ObjectId),
          referredUserId: new Types.ObjectId(newUser._id as Types.ObjectId),
          rewardType: "registration_bonus",
          triggerAction: "user_signup",
          note: "Referral at account registration",
          rewardStatus: "granted",
          rewardAmount: referralRegisteredPoints?.value || 0
        });
      } 
    }

    return await sendLoginSuccessResponse(newUser, res);

  } catch (err) {
    console.error('Facebook OAuth Error:', err);
    next(err instanceof RouteError ? err : new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, 'Facebook login failed'));
  }
};
