import jwt from 'jsonwebtoken';
import googleAuthHandler from './googleAuth';
import authorize from './authorize';
import cloudinary from '../common/cloudinary';
import multer from 'multer';
import { NextFunction, Router, Response } from 'express';
import validator from '../common/validator';
import { UserController } from '../controllers/User';
import { DB } from '../controllers';
import { IUserDoc } from '../models';
import AuthorizeAction from './authorize_action';

const upload = multer({
  storage: multer.memoryStorage(),
});

interface Request extends Express.Request {
  user?: any;
  body?: any;
  query?: any;
}

// Init shared
const router = Router();
const userControl = new UserController();

/******************************************************************************
 *                      add user - "POST /api/auth/register"
 ******************************************************************************/

router.post('/signup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, firstName, lastName, phoneNumber, userType } = validator.validate(req.body, 'userSignupSchema');

    const response = await userControl.signup(email, req.body.password, firstName, lastName, phoneNumber, userType);
    const { password, ...newUser } = response;
    return res.status(200).json({ ...newUser, success: true });
  } catch (error) {
    // console.log('error', error);
    next(error);
    // return res.status(400).json(error);
  }
});

router.get('/verify-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { access_token } = req.query;
    // const response = await userControl.verifyEmail(token as string);
    const { email } = (await jwt.verify(access_token as string, process.env.JWT_SECRET)) as { email: string };

    if (!email) {
      return res.status(400).json({
        message: 'Invalid token',
      });
    }
    const user = await DB.Models.User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        message: 'user not found',
      });
    }

    user.isAccountVerified = true;
    await user.save();

    const token = jwt.sign({ email, id: user._id }, process.env.JWT_SECRET, { expiresIn: '2d' });

    const { password, ...newUser } = user.toObject();
    return res.status(200).json({ ...newUser, token });
  } catch (error) {
    next(error);
  }
});

/******************************************************************************
 *                      add user - "POST /api/auth/register/google"
 ******************************************************************************/

router.post('/signup/google', googleAuthHandler, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, userType } = validator.validate(req.body, 'googleSignupSchema');
    const googleUserInfo = await userControl.googleSignup(code, userType);
    return res.status(200).json(googleUserInfo);
  } catch (error) {
    next(error);
  }
});

/******************************************************************************
 *                      get user - "GET /api/login/google"
 ******************************************************************************/

router.post('/login/google', googleAuthHandler, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = validator.validate(req.body, 'googleSignupSchema');
    const googleUserInfo = await userControl.googleLogin(code as string);
    return res.status(200).json(googleUserInfo);
  } catch (error) {
    next(error);
  }
});

/******************************************************************************
 *                      get agent auth details - "POST /api/auth/login"
 ******************************************************************************/

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  let response;
  let status;
  try {
    const reqBody = validator.validate(req.body, 'userLoginSchema');
    const { user, token } = await userControl.login({ email: reqBody.email, password: reqBody.password });
    status = 200;

    const { password, ...newUser } = user;
    return res.status(status).json({ user: newUser, token });
  } catch (error) {
    response = error;
    status = 400;
    next(error);
  }
});

/******************************************************************************
 *                      get password reset link details - "POST /api/auth/forgot-password"
 ******************************************************************************/

router.post('/request-password-reset', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: 'Please provide your email',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: 'Invalid email format',
      });
    }
    const response = await userControl.forgotPasswordResetLink(email);
    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/******************************************************************************
 *                      reset password - "POST /api/auth/reset-password"
 ******************************************************************************/

router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        message: 'Token and password are required',
      });
    }

    const response = await userControl.resetPassword(token, password);
    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

router.use(AuthorizeAction);

router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password, isAccountInRecovery, isDeleted, isInActive, ...data } = req.user._doc as IUserDoc;
    return res.status(200).json(data);
  } catch (error) {
    next(error);
  }
});
export { router as UserRouter };
