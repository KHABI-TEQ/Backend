import { Request, Response, NextFunction } from 'express';
import { DB } from '..';
import bcrypt from 'bcryptjs';
import HttpStatusCodes from '../../common/HttpStatusCodes';
import { RouteError } from '../../common/classes';

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, token, newPassword } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await DB.Models.User.findOne({ email: normalizedEmail });
    if (!user) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, 'No user found with this email.');
    }

    const resetToken = await DB.Models.PasswordResetToken.findOne({
      userId: user._id,
      token,
    });

    if (!resetToken || resetToken.expiresAt < new Date()) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, 'Invalid or expired token.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    await DB.Models.PasswordResetToken.deleteMany({ userId: user._id });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: 'Password reset successful. You can now log in.',
    });
  } catch (err: any) {
    console.error('Reset Password Error:', err.message);
    next(err);
  }
};
