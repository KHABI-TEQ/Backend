import { Request, Response, NextFunction } from 'express';
import { DB } from '..';
import HttpStatusCodes from '../../common/HttpStatusCodes';
import { RouteError } from '../../common/classes';

/**
 * @swagger
 * /auth/verifyPasswordResetCode:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Verify password reset code
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               code:
 *                 type: string
 *                 description: Password reset code
 *     responses:
 *       200:
 *         description: Reset code verified
 *       400:
 *         description: Bad request
 *       404:
 *         description: Invalid code
 */
export const verifyPasswordResetCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, token } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await DB.Models.User.findOne({ email: normalizedEmail });
    if (!user) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, 'No user found with this email.');
    }

    const resetToken = await DB.Models.PasswordResetToken.findOne({
      userId: user._id,
      token,
    });

    if (!resetToken) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, 'Invalid reset code.');
    }

    if (resetToken.expiresAt < new Date()) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, 'Reset code has expired.');
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: 'Reset code is valid.',
    });
  } catch (err: any) {
    console.error('Verify Reset Code Error:', err.message);
    next(err);
  }
};
