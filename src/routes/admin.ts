import express, { NextFunction, Response } from 'express';
import { AdminController } from '../controllers/Admin';
import { IAdmin, IAdminDoc } from '../models';
import { authorizeAdmin } from './admin.authorize';
import { DB } from '../controllers';
import HttpStatusCodes from '../common/HttpStatusCodes';

const AdminRouter = express.Router();
const adminController = new AdminController();

interface Request extends Express.Request {
  body?: any;
  params?: any;
  query?: any;
  admin?: any;
}

AdminRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const admin = await adminController.login({ email, password });
    return res.status(200).json({ success: true, admin });
  } catch (error) {
    next(error);
  }
});

AdminRouter.use(authorizeAdmin);

AdminRouter.post('/create-admin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName, phoneNumber, address } = req.body;
    const admin = await adminController.createAdmin({
      email,
      firstName,
      lastName,
      phoneNumber,
      address,
    });
    return res.status(200).json({ success: true, admin });
  } catch (error) {
    next(error);
  }
});

AdminRouter.post('/change-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = req.admin as IAdminDoc;
    const { newPassword } = req.body;

    const response = await adminController.changePassword(admin._id, newPassword);

    return res.status(200).json({ success: true, message: response });
  } catch (error) {
    next(error);
  }
});

AdminRouter.get('/agent/:agentId/properties', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.params;
    const { page, limit } = req.query;
    console.log(agentId, page, limit);
    const properties = await DB.Models.PropertySell.find({ owner: agentId })
      .populate('owner')
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .exec();

    const total = await DB.Models.PropertySell.countDocuments({ owner: agentId }).exec();

    return res.status(200).json({ success: true, properties, page: Number(page), limit: Number(limit), total });
  } catch (error) {
    next(error);
  }
});

AdminRouter.get('/all-users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await adminController.getAllUsers();
    return res.status(200).json({ success: true, users });
  } catch (error) {
    next(error);
  }
});

AdminRouter.post('/properties', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { briefType, ownerType, page, limit } = req.body;
    console.log(briefType, ownerType, page, limit);
    const properties = await adminController.getProperties(briefType, ownerType, page, limit);
    return res.status(200).json({ success: true, properties });
  } catch (error) {
    next(error);
  }
});

AdminRouter.get('/query-locations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query } = req.query;

    const locations = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${query}&key=AIzaSyComsDDl4oIXcxZc5wmw-6QSDyuiQrxLdA&types=geocode`
    );
    const locationsData = await locations.json();
    return res.status(200).json({ success: true, locationsData });
  } catch (error) {
    next(error);
  }
});

AdminRouter.get('/request/all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, propertyType } = req.query;

    if (!propertyType) {
      return res.status(400).json({ success: false, message: 'Property type is required' });
    }

    if (propertyType !== 'PropertySell' && propertyType !== 'PropertyRent') {
      return res.status(400).json({ success: false, message: 'Invalid property type' });
    }
    const requests = await adminController.getPropertyRequests(
      propertyType as 'PropertySell' | 'PropertyRent',
      Number(page),
      Number(limit)
    );
    return res.status(200).json({ success: true, requests });
  } catch (error) {
    next(error);
  }
});

AdminRouter.delete('/delete-property', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId, propertyType, ownerType } = req.body;
    const response = await adminController.deleteProperty(propertyType, propertyId, ownerType);
    return res.status(200).json({ success: true, response });
  } catch (error) {
    next(error);
  }
});

AdminRouter.post('/approve-disapprove-property', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId, status } = req.body;
    const response = await adminController.approveOrDisapproveProperty(propertyId, status);
    return res.status(200).json({ success: true, response });
  } catch (error) {
    next(error);
  }
});

AdminRouter.post('/activate-deactivate-agent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId, inActiveSatatus, reason } = req.body;
    const response = await adminController.deactivateAgent(agentId, inActiveSatatus, reason);
    return res.status(200).json({ success: true, response });
  } catch (error) {
    next(error);
  }
});

AdminRouter.delete('/delete-agent/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const response = await adminController.deleteAgent(id, reason);
    return res.status(200).json({ success: true, response });
  } catch (error) {
    next(error);
  }
});

AdminRouter.get('/all-agents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, type, userType } = req.query;
    const agents = await adminController.getAgents(Number(page), Number(limit), type, userType);
    return res.status(200).json({ success: true, agents });
  } catch (error) {
    next(error);
  }
});

AdminRouter.post('/approve-agent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId, approved } = req.body;
    const response = await adminController.approveAgent(agentId, approved);
    return res.status(200).json({ success: true, response });
  } catch (error) {
    next(error);
  }
});

AdminRouter.put('/agent/flag/:agentId/:status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId, status } = req.params;
    const isFlagged = status === 'true' ? true : false;
    await DB.Models.Agent.findByIdAndUpdate(agentId, { isFlagged: isFlagged });
    return res
      .status(200)
      .json({ success: true, message: isFlagged ? 'Agent flagged successfully' : 'Agent unflagged successfully' });
  } catch (error) {
    next(error);
  }
});

AdminRouter.post('/property/new', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      propertyType,
      propertyCondition,
      location,
      briefType,
      price,
      landSize,
      features,
      tenantCriteria,
      areYouTheOwner,
      isAvailable,
      budgetRange,
      pictures,
      isApproved,
      isRejected,
      docOnProperty,
      additionalFeatures,
      buildingType,
      owner,
      additionalInfo,
      isPremium,
    } = req.body;
    const response = await adminController.add({
      propertyType,
      propertyCondition,
      location,
      briefType,
      price,
      landSize,
      features,
      tenantCriteria,
      areYouTheOwner,
      isAvailable,
      budgetRange,
      pictures,
      isApproved,
      isRejected,
      docOnProperty,
      additionalFeatures,
      buildingType,
      owner: {
        email: owner.email,
        fullName: owner.fullName,
        phoneNumber: owner.phoneNumber,
      },
      additionalInfo,
      isPremium,
    });
    return res.status(HttpStatusCodes.CREATED).json(response);
  } catch (error) {
    next(error);
  }
});

AdminRouter.post('/upgrade-agent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId, approved } = req.body;
    const response = await adminController.approveUpgradeRequest(agentId, approved);
    return res.status(200).json({ success: true, response });
  } catch (error) {
    next(error);
  }
});

AdminRouter.post('/properties-users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userType, page, limit } = req.body;

    const properties = await adminController.getAllPropertiesWithOwnersGrouped(userType, page, limit);

    return res.status(200).json(properties);
  } catch (error) {
    next(error);
  }
});

AdminRouter.put('/property/:propertyId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId } = req.params;
    const { propertyType, propertyData } = req.body;
    const response = await adminController.updateProperty(propertyId, propertyType, propertyData);
    return res.status(200).json({ success: true, response });
  } catch (error) {
    next(error);
  }
});

export default AdminRouter;
