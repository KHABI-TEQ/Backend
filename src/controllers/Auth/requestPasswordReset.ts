import { Request, Response, NextFunction } from 'express';
import { DB } from '..';
import HttpStatusCodes from '../../common/HttpStatusCodes';
import { RouteError } from '../../common/classes';
import sendEmail from '../../common/send.email';
import { generalTemplate, ForgotPasswordTokenTemplate } from '../../common/email.template';

export const requestPasswordReset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    const user = await DB.Models.User.findOne({ email: normalizedEmail });

    if (!user) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, 'No user found with this email.');
    }

    // Remove existing tokens
    await DB.Models.PasswordResetToken.deleteMany({ userId: user._id });

    const token = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes

    await DB.Models.PasswordResetToken.create({
        userId: user._id,
        userModel: 'User',
        token,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    await DB.Models.PasswordResetToken.create({
      userId: user._id,
      token,
      expiresAt,
    });

    const mailBody = ForgotPasswordTokenTemplate(user.firstName, token);
    const html = generalTemplate(mailBody);

    await sendEmail({
      to: user.email,
      subject: 'Your Password Reset Code',
      text: `Your password reset code is ${token}`,
      html,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: 'Reset code sent to your email.',
    });
  } catch (err: any) {
    console.error('Password Reset Error:', err.message);
    next(err);
  }
};
