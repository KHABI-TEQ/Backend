import { Request, Response, NextFunction } from 'express';
import { DB } from '..';
import HttpStatusCodes from '../../common/HttpStatusCodes';
import { RouteError } from '../../common/classes';
import sendEmail from '../../common/send.email';
import { generalTemplate, ForgotPasswordTokenTemplate } from '../../common/email.template';

export const resendPasswordResetCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await DB.Models.User.findOne({ email: normalizedEmail });
    if (!user) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, 'No user found with this email.');
    }

    // Remove existing tokens
    await DB.Models.PasswordResetToken.deleteMany({ userId: user._id });

    const token = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit token
    const expiresAt = new Date(Date.now() + 1000 * 60 * 20); // 20 minutes

    await DB.Models.PasswordResetToken.create({
      userId: user._id,
      token,
      expiresAt,
    });

    const mailBody = ForgotPasswordTokenTemplate(user.firstName || user.email, token);
    const html = generalTemplate(mailBody);

    await sendEmail({
      to: user.email,
      subject: 'Your Password Reset Code',
      text: `Your password reset code is ${token}`,
      html,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: 'Password reset code resent successfully.',
    });
  } catch (err: any) {
    console.error('Resend Reset Code Error:', err.message);
    next(err);
  }
};
