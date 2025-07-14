import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { DB } from '..';
import HttpStatusCodes from '../../common/HttpStatusCodes';
import { RouteError } from '../../common/classes';
import { verifyEmailTemplate, generalTemplate } from '../../common/email.template';
import sendEmail from '../../common/send.email';

export const resendVerificationToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await DB.Models.User.findOne({ email: normalizedEmail });

    if (!user) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Account not found.');
    }

    if (user.isAccountVerified) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Email is already verified.');
    }

    // Remove any existing token
    await DB.Models.VerificationToken.deleteMany({ userId: user._id });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours

    await DB.Models.VerificationToken.create({ userId: user._id, token, expiresAt });

    const verificationLink = `${process.env.CLIENT_LINK}/auth/verify-account?token=${token}`;
    const mailBody = verifyEmailTemplate(user.firstName || user.email, verificationLink);
    const html = generalTemplate(mailBody);

    await sendEmail({
      to: user.email,
      subject: 'Verify Your Email Address',
      text: 'Please verify your email.',
      html,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: 'Verification email resent successfully.',
    });
  } catch (err: any) {
    console.error('Resend Verification Error:', err.message);
    next(err);
  }
};
