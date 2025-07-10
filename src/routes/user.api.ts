import jwt from 'jsonwebtoken';
import googleAuthHandler from './googleAuth';
import { authorize } from './authorize';
import cloudinary from '../common/cloudinary';
import multer from 'multer';
import { NextFunction, Router, Response } from 'express';
import validator from '../common/validator';
import { UserController } from '../controllers/User';
import { DB } from '../controllers';
import { IAgentDoc, IUserDoc } from '../models';
import { ParamsDictionary } from "express-serve-static-core";
import AuthorizeAction from './authorize_action';
import mongoose from 'mongoose';
import NotificationService from '../services/notification.service';

const upload = multer({
  storage: multer.memoryStorage(),
});

interface Request extends Express.Request {
	user?: any;
	query?: any;
	params?: any;
	body?: any;
}

// Init shared
const router = Router();
const userControl = new UserController();

const validStatus = ["approved", "pending", "all"] as const;
type ValidStatus = typeof validStatus[number];


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

router.post('/change-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, token } = req.body;

    if (!email) {
      return res.status(400).json({
        message: 'Please provide your email',
      });
    }

    if (!token) {
      return res.status(400).json({
        message: 'Token is required',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: 'Invalid email format',
      });
    }

    const response = await userControl.changeEmail(token, email);
    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

router.get('/resend-verification-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.query;
    const response = await userControl.resendEmailVerification(token);
    return res.status(200).json(response);
  } catch (error) {
    next(error);
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
    const { code, userType } = req.body;
    if (!code) {
      return res.status(400).json({
        message: 'Authorization code is required',
      });
    }
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
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({
        message: 'Authorization code is required',
      });
    }
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


router.get(
  "/dashboard",
  AuthorizeAction,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const landlord = req.user as IUserDoc;

      if (landlord.userType !== "Landowners") {
        return res.status(403).json({ success: false, message: "Access denied" });
      }

      const matchOwner = { owner: landlord._id };

      const totalBriefs = await DB.Models.Property.countDocuments(matchOwner);

      const totalActiveBriefs = await DB.Models.Property.countDocuments({
        ...matchOwner,
        isApproved: true,
      });

      const totalInactiveBriefs = await DB.Models.Property.countDocuments({
        ...matchOwner,
        isApproved: false,
      });

      const propertySold = await DB.Models.Property.countDocuments({
        ...matchOwner,
        isAvailable: "no", // Or whatever logic represents "sold"
      });

      const totalViews = await DB.Models.Property.aggregate([
        { $match: { owner: landlord._id } },
        { $group: { _id: null, total: { $sum: "$views" } } },
      ]);

      const recentBriefs = await DB.Models.Property.find({
        ...matchOwner,
        isApproved: true,
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("location.price propertyType pictures isApproved");

      const newPendingBriefs = await DB.Models.Property.find({
        ...matchOwner,
        isApproved: false,
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("location.price propertyType pictures isApproved");

      return res.status(200).json({
        success: true,
        dashboard: {
          totalBriefs,
          totalActiveBriefs,
          totalInactiveBriefs,
          propertySold,
          totalViews: totalViews[0]?.total || 0,
          recentBriefs,
          newPendingBriefs,
        },
      });
    } catch (error) {
      console.error("Dashboard error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while fetching dashboard data.",
      });
    }
  }
);

router.get(
  "/briefs",
  AuthorizeAction,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as IUserDoc | IAgentDoc;

      const {
        page = "1",
        limit = "10",
        briefType,
        location,
        priceRange,
        documentType,
        bedroom,
        bathroom,
        landSizeType,
        landSize,
        desireFeature,
        homeCondition,
        tenantCriteria,
        type,
        isPremium,
        isPreference,
        status,
      } = req.query as Record<string, string>;

      const parsedStatus = validStatus.includes(status as ValidStatus)
        ? (status as ValidStatus)
        : undefined;

      const filters = {
        location: location || undefined,
        priceRange: priceRange ? JSON.parse(priceRange) : undefined,
        documentType: documentType ? documentType.split(",") : undefined,
        desireFeature: desireFeature ? desireFeature.split(",") : undefined,
        tenantCriteria: tenantCriteria ? tenantCriteria.split(",") : undefined,
        homeCondition: homeCondition || undefined,
        landSizeType: landSizeType || undefined,
        status: parsedStatus,
        bedroom: bedroom ? Number(bedroom) : undefined,
        bathroom: bathroom ? Number(bathroom) : undefined,
        landSize: landSize ? Number(landSize) : undefined,
        isPremium: isPremium ? isPremium === "true" : undefined,
        isPreference: isPreference ? isPreference === "true" : undefined,
        briefType: briefType ? briefType.split(",") : undefined,
        type: type ? type.split(",") : undefined,
        owner: user._id.toString(),
      };

      const result = await userControl.getBriefsByOwner(
        Number(page),
        Number(limit),
        filters
      );

      return res.status(200).json({
        success: true,
        data: result.data,
        filtersUsed: filters, // 🔥 Attach filters here
        pagination: {
          total: result.total,
          currentPage: result.currentPage,
          totalPages: Math.ceil(result.total / Number(limit)),
          perPage: Number(limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/briefs/:_id",
  AuthorizeAction,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { _id } = req.params;

      const property = await userControl.getBriefById(_id);

      return res.status(200).send({
        success: true,
        data: property
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/briefs/:_id",
  AuthorizeAction,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { _id } = req.params;

      // Optional: Validate ObjectId
      if (!mongoose.isValidObjectId(_id)) {
        return res.status(400).json({ error: "Invalid property ID." });
      }

      const deleted = await userControl.deleteBriefById(_id);

      if (!deleted) {
        return res.status(404).json({ error: "Brief not found or already deleted." });
      }

      return res.status(200).json({
        success: true,
        message: "Brief deleted successfully.",
      });
    } catch (error) {
      next(error);
    }
  }
);


// GET /users/notifications
router.get('/notifications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notifications = await NotificationService.getAll(req.user._id, req.query);
    res.status(200).json({ success: true, data: notifications });
  } catch (err) {
    next(err);
  }
});

// GET /users/notifications/:notificationId
router.get('/notifications/:notificationId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { notificationId } = req.params;
    if (!mongoose.isValidObjectId(notificationId)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }

    const notification = await NotificationService.getById(notificationId);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.status(200).json({ success: true, data: notification });
  } catch (err) {
    next(err);
  }
});

// PATCH /users/notifications/:notificationId/markRead
router.patch('/notifications/:notificationId/markRead', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { notificationId } = req.params;
    if (!mongoose.isValidObjectId(notificationId)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }

    const marked = await NotificationService.markRead(notificationId);
    if (!marked) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.status(200).json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    next(err);
  }
});

// PATCH /users/notifications/markAllRead
router.patch('/notifications/markAllRead', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await NotificationService.markAllRead(req.user._id);
    res.status(200).json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    next(err);
  }
});

// DELETE /users/notifications/:notificationId/delete
router.delete('/notifications/:notificationId/delete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { notificationId } = req.params;
    if (!mongoose.isValidObjectId(notificationId)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }

    const deleted = await NotificationService.delete(notificationId);
    if (!deleted) {
      return res.status(404).json({ error: 'Notification not found or already deleted.' });
    }

    res.status(200).json({ success: true, message: 'Notification deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

// DELETE /users/notifications/deleteAll
router.delete('/notifications/deleteAll', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await NotificationService.deleteAll(req.user._id);
    res.status(200).json({ success: true, message: 'All notifications cleared successfully.' });
  } catch (err) {
    next(err);
  }
});


export { router as UserRouter };
