import { NextFunction, Response, Router } from 'express';

import { AgentController, DB } from '../controllers';
import validator from '../common/validator';
import HttpStatusCodes from '../common/HttpStatusCodes';
import { IAgentDoc, IUserDoc, PropertyRent, PropertySell } from '../models';
import jwt from 'jsonwebtoken';
import googleAuthHandler from './googleAuth';
import authorize from './authorize';
import cloudinary from '../common/cloudinary';
import multer from 'multer';
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
const agentControl = new AgentController();

router.use(AuthorizeAction);

/******************************************************************************
 *                      onboard agent - "POST /api/auth/onboard"
 ******************************************************************************/

router.put('/onboard', async (req: Request, res: Response, next: NextFunction) => {
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

router.post('/confirm-property', async (req: Request, res: Response, next: NextFunction) => {
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

router.get('/preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // const rentPreferences = await DB.Models.PropertyRent.find({
    //   ownerModel: 'BuyerOrRenter',
    // });

    const user = req.user as IUserDoc;

    const sellPreferences = await DB.Models.PropertySell.find({
      ownerModel: 'BuyerOrRenter',
      'location.state': user.address.state,
    }).then((properties) =>
      properties.map((property) => {
        const { owner, ...propertyData } = property.toObject();
        return propertyData;
      })
    );

    return res.status(200).json({
      sellPreferences,
      success: true,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as IAgentDoc;

    const propertiesSells = await DB.Models.PropertySell.find({ owner: user._id });
    const propertiesRents = await DB.Models.PropertyRent.find({ owner: user._id });

    const requests = await DB.Models.PropertyRequest.find({
      propertyId: { $in: [...propertiesSells.map((p) => p._id), ...propertiesRents.map((p) => p._id)] },
    })
      // .populate({ path: 'propertyId' })
      .populate({ path: 'propertyId' })
      .populate({ path: 'requestFrom' })
      .then((requests) =>
        requests.map((request) => {
          const { requestFrom, ...otherData } = request.toObject();

          return otherData;
        })
      );

    // const property = await DB.Models.PropertySell.findById(requests[0].propertyId);
    // console.log('Property', property);

    return res.status(200).json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
});

router.post('/update-profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agent = req.user as IAgentDoc;
    const profileData = validator.validate(req.body, 'agentProfileUpdateSchema');

    const response = await agentControl.updateProfile(agent, profileData);
    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

router.post('/upload-profile-pic', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({ message: 'File is required' });
    }

    const agent = req.user as IAgentDoc;

    // Convert the buffer to a Base64 string
    const fileBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    // Upload to Cloudinary
    const uploadImg = await cloudinary.uploadFile(fileBase64, `${agent._id}/profile-image`, 'profile-images');

    await DB.Models.Agent.findByIdAndUpdate(agent._id, {
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

router.post('/account-upgrade', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agent = req.user as IAgentDoc;
    const { companyAgent, meansOfId } = validator.validate(req.body, 'acctUpgradeSchema');

    const response = await agentControl.acctUpgrade(agent, { companyAgent, meansOfId });
    return res.status(200).json({
      message: 'Account upgrade request submitted successfully',
      success: true,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/account', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agent = req.user as IUserDoc;

    const { password, isAccountInRecovery, isDeleted, isInActive, ...data } = agent.toObject();

    const agentData = await DB.Models.Agent.findById(agent._id);

    return res.status(200).json({
      success: true,
      user: { ...data, agentData },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/properties', async (req: Request, res: Response, next: NextFunction) => {
  const agent = req.user as IAgentDoc;

  console.log('Agent ID', agent._id);

  const sellProperties = await DB.Models.PropertySell.find({ owner: agent._id }).exec();

  const rentProperties = await DB.Models.PropertyRent.find({ owner: agent._id }).exec();

  return res.status(200).json({
    success: true,
    properties: {
      sellProperties,
      rentProperties,
    },
  });
});

export default router;
