import { NextFunction, Response, Router } from 'express';

import {AgentController} from '../controllers/Agent'
import { DB } from '../controllers';
import validator from '../common/validator';
import HttpStatusCodes from '../common/HttpStatusCodes';
import { IAgentDoc, IUser, IUserDoc, PropertyRent, PropertySell } from '../models';
import jwt from 'jsonwebtoken';
import googleAuthHandler from './googleAuth';
import cloudinary from '../common/cloudinary';
import multer from 'multer';
import AuthorizeAction from './authorize_action';
import bcrypt from 'bcryptjs';

const upload = multer({
  storage: multer.memoryStorage(),
});

const agentController = new AgentController()

interface Request extends Express.Request {
  user?: any;
  body?: any;
  query?: any;
  params?:any;
}

// Init shared
const router =  Router();
const agentControl = new AgentController();

/******************************************************************************
 *                      onboard agent - "POST /api/auth/onboard"
 ******************************************************************************/
router.get('/all-preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
   const preferences = await agentController.getAllPreferences()
    return res.status(200).json({
      preferences,
      success: true,
    });
  } catch (error) {
    next(error);
  }
});

router.put('/onboard',AuthorizeAction, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address, regionOfOperation, agentType, companyAgent, govtId, meansOfId } = req.body;
    const user = req.user as IUserDoc;

    const response = await agentControl.onboard(
      user.email,
      address,
      regionOfOperation,
      agentType,
      companyAgent,
      meansOfId,
      govtId
    );
    return res.status(HttpStatusCodes.OK).json({
      message: 'Agent information updated successfully',
      success: true,
      token: response.token,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
});

/******************************************************************************
 * Confirms Property Availability for Inspection  - "POST /api/agent/confirm-property"
 */

router.post('/confirm-property',AuthorizeAction, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { requestId, isAvailable } = req.body;
    const response = await agentControl.confirmPropertyAvailability(requestId, isAvailable);
    return res.status(HttpStatusCodes.OK).json({
      message: response,
      success: true,
    });
  } catch (error) {
    next(error);
  }
});

/******************************************************************************
 * All preferences from buyers/renters  - "POST /api/agent/preferences"
 */
router.get('/my-location-preferences',AuthorizeAction, async (req: Request, res: Response, next: NextFunction) => {
  try {
   const user = req.user as IUserDoc;
   const preferences = await agentController.getMatchingPreferences(user)
    return res.status(200).json({
      preferences,
      success: true,
    });
  } catch (error) {
    next(error);
  }
});


router.post(
  '/create-brief/:preferenceId?', // preferenceId is optional
  AuthorizeAction,
  upload.array('pictures'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user;
      const files = req.files as Express.Multer.File[];
      const preferenceId = req.params.preferenceId;

      const property = await agentController.createBriefProperty(user, req.body, files, preferenceId);

      return res.status(HttpStatusCodes.CREATED).json({
        message: 'Brief created successfully',
        data: property,
      });
    } catch (error) {
      console.error(error);
      res.status(error.status || 500).json({ message: error.message || 'Internal Server Error' });
    }
  }
);


router.get('/requests', AuthorizeAction, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as IAgentDoc;

    // const propertiesSells = await DB.Models.PropertySell.find({ owner: user._id });
    // const propertiesRents = await DB.Models.PropertyRent.find({ owner: user._id });

    // const requests = await DB.Models.PropertyRequest.find({
    //   propertyId: { $in: [...propertiesSells.map((p) => p._id), ...propertiesRents.map((p) => p._id)] },
    // })
    //   // .populate({ path: 'propertyId' })
    //   .populate({ path: 'propertyId' })
    //   .populate({ path: 'requestFrom' })
    //   .then((requests) =>
    //     requests.map((request) => {
    //       const { requestFrom, ...otherData } = request.toObject();

    //       return otherData;
    //     })
    //   );
    const requests = await DB.Models.InspectionBooking.find({ owner: user._id }).populate([
      { path: 'propertyId', model: 'Property' },
      { path: 'requestedBy', model: 'Buyer' },
      { path: 'transaction', model: 'Transaction' },
    ]);

    // const property = await DB.Models.PropertySell.findById(requests[0].propertyId);
    // console.log('Property', property);

    return res.status(200).json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
});

router.post('/update-profile', AuthorizeAction, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agent = req.user as IUserDoc;
    const profileData = req.body;

    const response = await agentControl.updateProfile(agent, profileData);
    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

router.post('/change-password',AuthorizeAction, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agent = req.user as IUserDoc;
    const { oldPassword, newPassword } = req.body;

    console.log(oldPassword);
    console.log(agent);

    const compare = await bcrypt.compare(oldPassword, agent.password);
    console.log('Password comparison result:', compare);
    if (!compare) {
      return res.status(HttpStatusCodes.UNAUTHORIZED).json({
        message: 'Old password is incorrect',
        success: false,
      });
    }
    const hashNew = await bcrypt.hash(newPassword, 10);
    await DB.Models.User.findByIdAndUpdate(agent._id, { password: hashNew });

    return res.status(200).json({
      message: 'Password changed successfully',
      success: true,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/upload-profile-pic',AuthorizeAction, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({ message: 'File is required' });
    }

    const agent = req.user as IAgentDoc;

    // Convert the buffer to a Base64 string
    const fileBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    // Upload to Cloudinary
    const uploadImg = await cloudinary.uploadFile(fileBase64, `${agent._id}/profile-image`, 'profile-images');

    await DB.Models.Agent.findOneAndUpdate(agent._id, {
      $set: {
        profile_picture: uploadImg,
      },
    });

    return res.status(HttpStatusCodes.OK).json({
      message: 'Image uploaded successfully',
      url: uploadImg,
    });
  } catch (error) {
    console.error(error);
    res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
  }
});

router.post('/account-upgrade',AuthorizeAction, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agent = req.user as IUserDoc;
    const { companyAgent, meansOfId } = req.body;

    const response = await agentControl.acctUpgrade(agent, { companyAgent, meansOfId });
    return res.status(200).json({
      message: 'Account upgrade request submitted successfully',
      success: true,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/account',AuthorizeAction, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agent = req.user as IUserDoc;

    const { password, isAccountInRecovery, isDeleted, isInActive, ...data } = agent.toObject();

    const agentData = await DB.Models.Agent.findOne({ userId: agent._id });

    return res.status(200).json({
      success: true,
      user: { ...data, agentData },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/properties',AuthorizeAction, async (req: Request, res: Response, next: NextFunction) => {
  const agent = req.user as IAgentDoc;

  const activeBrief = await DB.Models.Property.find({
    owner: agent._id,
    isApproved: true,
    isPreference: false,
  });

  const pendingBrief = await DB.Models.Property.find({
    owner: agent._id,
    isApproved: false,
    isPreference: false,
  });

  const totalProperties = await DB.Models.Property.countDocuments({ owner: agent._id });

  return res.status(200).json({
    success: true,
    properties: {
      active: activeBrief,
      pending: pendingBrief,
      total: totalProperties,
      dealsClosed: 0,
    },
  });
});

export default router;
