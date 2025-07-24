import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { DB } from '..';
import { generateUniqueAccountId } from '../../utils/generateUniqueAccountId';
import HttpStatusCodes from '../../common/HttpStatusCodes';
import { generateToken, RouteError } from '../../common/classes';

// Initialize Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID!);

// 🔄 Shared response formatter
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
        return res.status(HttpStatusCodes.OK).json({
            message: 'Login successful',
            token,
            user: userResponse,
            agentData,
            isAccountApproved: user.accountApproved,
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
export const googleAuth = async (req: Request, res: Response, next: NextFunction) => {
  // userType is now optional
  const { idToken, userType } = req.body;

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
      // User found: proceed with login logic
      if (!user.googleId) {
        user.googleId = sub;
        await user.save();
      }

      // Comprehensive account status checks for existing users
      if (!user.isAccountVerified) {
        throw new RouteError(HttpStatusCodes.FORBIDDEN, 'Your account requires email verification.');
      }
      
      if (user.isInActive || user.isDeleted || user.accountStatus === 'inactive' || user.accountStatus === 'deleted') {
        throw new RouteError(HttpStatusCodes.FORBIDDEN, 'Your account is inactive or has been deleted. Please contact support.');
      }

      await sendLoginSuccessResponse(user, res);

    } else {
      // User not found: determine if it's a registration attempt or an error
      if (userType) {
        // userType was provided, proceed with registration
        const accountId = await generateUniqueAccountId();
        const newUser = await DB.Models.User.create({
          email: normalizedEmail,
          firstName: given_name,
          lastName: family_name,
          userType, // Use the provided userType
          googleId: sub,
          isAccountVerified: true,
          accountApproved: userType === 'Agent' ? false : true,
          accountStatus: 'active',
          profile_picture: picture,
          accountId,
          isAccountInRecovery: false,
          isInActive: false,
          isDeleted: false,
          isFlagged: false,
        });

        if (userType === 'Agent') {
          // Assuming DB.Models.Agent exists and has a userId field
          await DB.Models.Agent.create({ userId: newUser._id, accountStatus: 'active' });
        } 

      } else {
        throw new RouteError(
          HttpStatusCodes.NOT_FOUND,
          'Account not found. If you are a new user, please register first, specifying your account type (Landowners or Agent).'
        );
      }
    }
  } catch (err) {
    console.error('Google OAuth Error:', err);
    // Pass custom RouteError to the next middleware (your error handler)
    next(err);
    if (err instanceof RouteError) {
      next(err);
    } else {
      next(new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, 'Google login failed'));
    }
  }
};

// ✅ FACEBOOK AUTH HANDLER
export const facebookAuth = async (req: Request, res: Response, next: NextFunction) => {
  // userType is now optional
  const { idToken, userType } = req.body; // idToken here is actually accessToken from Facebook

  try {
    // 1. Verify access token with Facebook
    const fbUrl = `https://graph.facebook.com/me?fields=id,first_name,last_name,email,picture&access_token=${idToken}`;
    const fbRes = await fetch(fbUrl);
    const fbData = await fbRes.json();

    // Check for Facebook API errors
    if (fbData.error) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, fbData.error.message || 'Invalid Facebook token.');
    }

    if (!fbData.email) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Facebook email not found. Please ensure your Facebook account has an email.');
    }

    const { id, email, first_name, last_name, picture } = fbData;
    const normalizedEmail = email.toLowerCase();

    let user = await DB.Models.User.findOne({ email: normalizedEmail });

    if (user) {
      // User found: proceed with login logic
      if (!user.facebookId) {
        user.facebookId = id;
        await user.save();
      }

      // Comprehensive account status checks for existing users
      if (!user.isAccountVerified) {
        throw new RouteError(HttpStatusCodes.FORBIDDEN, 'Your account requires email verification.');
      }
      
      if (user.isInActive || user.isDeleted || user.accountStatus === 'inactive' || user.accountStatus === 'deleted') {
        throw new RouteError(HttpStatusCodes.FORBIDDEN, 'Your account is inactive or has been deleted. Please contact support.');
      }

      await sendLoginSuccessResponse(user, res);

    } else {
      // User not found: determine if it's a registration attempt or an error
      if (userType) {
        // userType was provided, proceed with registration
        const accountId = await generateUniqueAccountId();
        const newUser = await DB.Models.User.create({
          email: normalizedEmail,
          firstName: first_name,
          lastName: last_name,
          userType, // Use the provided userType
          facebookId: id,
          isAccountVerified: true, // Facebook email is considered verified by Facebook
          accountApproved: userType === 'Agent' ? false : true, // Agents require approval
          accountStatus: userType === 'Agent' ? 'inactive' : 'active',
          profile_picture: picture?.data?.url || '', // Handle nested picture data
          accountId,
          isAccountInRecovery: false,
          isInActive: false,
          isDeleted: false,
          isFlagged: false,
        });

        if (userType === 'Agent') {
          await DB.Models.Agent.create({ userId: newUser._id, accountStatus: 'active' });
        }

      } else {
        // userType was NOT provided, and account not found.
        throw new RouteError(
          HttpStatusCodes.NOT_FOUND,
          'Account not found. If you are a new user, please register first, specifying your account type (Landowners or Agent).'
        );
      }
    }
  } catch (err) {
    console.error('Facebook OAuth Error:', err);
    if (err instanceof RouteError) {
      next(err);
    } else {
      next(new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, 'Facebook login failed'));
    }
  }
};