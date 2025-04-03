import { NextFunction, Request, Response, Router } from 'express';

import { AgentController, DB } from '../controllers';
import validator from '../common/validator';
import HttpStatusCodes from '../common/HttpStatusCodes';
import { IAgentDoc, PropertyRent, PropertySell } from '../models';
import jwt from 'jsonwebtoken';
import googleAuthHandler from './googleAuth';
import authorize from './authorize';

// Init shared
const router = Router();
const agentControl = new AgentController();

/******************************************************************************
 *                      add user - "POST /api/auth/register"
 ******************************************************************************/

router.post('/signup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, firstName, lastName, phoneNumber } = validator.validate(req.body, 'agentSignupSchema');

    const response = await agentControl.signup(email, req.body.password, firstName, lastName, phoneNumber);
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
    // const response = await agentControl.verifyEmail(token as string);
    const { email } = (await jwt.verify(access_token as string, process.env.JWT_SECRET)) as { email: string };

    if (!email) {
      return res.status(400).json({
        message: 'Invalid token',
      });
    }
    const agent = await DB.Models.Agent.findOne({ email });

    if (!agent) {
      return res.status(400).json({
        message: 'Agent not found',
      });
    }

    agent.isAccountVerified = true;
    await agent.save();

    const token = jwt.sign({ email, id: agent._id }, process.env.JWT_SECRET, { expiresIn: '2d' });

    const { password, ...newUser } = agent.toObject();
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
    const { idToken } = validator.validate(req.body, 'googleSignupSchema');
    const googleUserInfo = await agentControl.googleSignup(idToken);
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
    const { idToken } = validator.validate(req.body, 'googleSignupSchema');
    const googleUserInfo = await agentControl.googleLogin(idToken as string);
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
    const reqBody = validator.validate(req.body, 'agentLoginSchema');
    const { user, token } = await agentControl.login({ email: reqBody.email, password: reqBody.password });
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
    const response = await agentControl.forgotPasswordResetLink(email);
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

    const response = await agentControl.resetPassword(token, password);
    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

router.use(authorize);

/******************************************************************************
 *                      onboard agent - "POST /api/auth/onboard"
 ******************************************************************************/

router.put('/onboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      token,
      address,
      regionOfOperation,
      agentType,
      companyAgent,
      individualAgent,
      meansOfId,
      phoneNumber,
      lastName,
      firstName,
    } = validator.validate(req.body, 'agentOnboardSchema');

    const decodeToken = (await jwt.verify(token, process.env.JWT_SECRET)) as any;

    console.log('Body Request', req.body);

    const response = await agentControl.onboard(
      decodeToken.email,
      address,
      regionOfOperation,
      agentType,
      companyAgent,
      individualAgent,
      phoneNumber,
      lastName,
      firstName,
      meansOfId
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

router.get('/profile', async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as IAgentDoc;

  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { password, ...others } = user.toObject();
  return res.status(200).json({
    success: true,
    data: others,
  });
});

router.post('/upload/image', async (req: Request & { file?: any }, res: Response, next: NextFunction) => {
  try {
    const { image } = req.body;
    console.log(req?.file);
    const response = await agentControl.uploadImage(image);
    return res.status(HttpStatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
});
/******************************************************************************
 *                      add user - "POST /api/auth/register"
 ******************************************************************************/
router.post('/properties', async (req: Request, res: Response, next: NextFunction) => {
  // const {} = req.agent
  try {
    // const properties1 = await DB.Models.PropertyRent.find({ owner: req.agent._id });
    // const properties2 = await DB.Models.PropertySell.find({ owner: req.agent._id });
    // const properties = [...properties1, ...properties2];
    // return res.status(200).json(properties);
  } catch (error) {
    next(error);
  }
});

router.get('/properties', async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as IAgentDoc;

  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const rentProperties = await DB.Models.PropertyRent.find({ owner: user._id });

  const sellProperties = await DB.Models.PropertySell.find({ owner: user._id });

  return res.status(200).json({
    success: true,
    data: {
      rentProperties,
      sellProperties,
    },
  });
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
    const rentPreferences = await DB.Models.PropertyRent.find({
      ownerModel: 'BuyerOrRenter',
    });

    const sellPreferences = await DB.Models.PropertySell.find({
      ownerModel: 'BuyerOrRenter',
    });

    return res.status(200).json({
      rentPreferences,
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
      .populate({ path: 'requestFrom' });

    // const property = await DB.Models.PropertySell.findById(requests[0].propertyId);
    // console.log('Property', property);

    return res.status(200).json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
});

/******************************************************************************
 *                                     Export
 ******************************************************************************/
export default router;
