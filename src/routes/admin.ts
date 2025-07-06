import express, { NextFunction, Response } from 'express';
import { AdminController } from '../controllers/Admin';
import { IAdmin, IAdminDoc } from '../models';
import { authorizeAdmin } from './admin.authorize';
import { DB } from '../controllers';
import HttpStatusCodes from '../common/HttpStatusCodes';
import AdminInspRouter from './admin.inspections';
import { formatPropertyDataForTable } from '../utils/propertyFormatters';

const AdminRouter = express.Router();
const adminController = new AdminController();

interface Request extends Express.Request {
  body?: any;
  params?: any;
  query?: any;
  admin?: any;
}

//=================================

AdminRouter.post('/assign-buyers-to-preferences', async (req, res, next) => {
  try {
    const result = await adminController.randomlyAssignBuyersToPreferences();
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

//================================

// Allow login and create-admin without auth
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

// Get current admin info
AdminRouter.get('/me', authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.status(200).json({ success: true, admin: req.admin });
  } catch (error) {
    next(error);
  }
});


// Protect all other admin routes
// AdminRouter.use(authorize);


AdminRouter.post('/create-admin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName, phoneNumber, address } = req.body;
    const admin = await adminController.createAdmin({
      email,
      firstName,
      lastName,
      phoneNumber,
      address,
      password
    });
    return res.status(200).json({ success: true, admin });
  } catch (error) {
    next(error);
  }
});

AdminRouter.get('/admins', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, search, ...filters } = req.query;

    const admins = await adminController.getAdmins({
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 10,
      search: search as string,
      filters,
    });

    return res.status(200).json({ success: true, ...admins });
  } catch (err) {
    next(err);
  }
});

AdminRouter.delete('/admins/:adminId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { adminId } = req.params;
    const result = await adminController.deleteAdmin(adminId);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

AdminRouter.get('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.status(200).json({ success: true, admin: req.admin });
  } catch (error) {
    next(error);
  }
});

AdminRouter.post('/change-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = req.admin as IAdminDoc;
    const { newPassword } = req.body;

    const adminID = admin._id.toString();

    const response = await adminController.changePassword(adminID, newPassword);

    return res.status(200).json({ success: true, message: response });
  } catch (error) {
    next(error);
  }
});

AdminRouter.get('/all-properties', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      ownerType: req.query.ownerType as 'Agent' | 'Landowners' | 'All',
      isPremium: req.query.isPremium as string,
      isApproved: req.query.isApproved as string,
      isRejected: req.query.isRejected as string,
      isAvailable: req.query.isAvailable as string,
      briefType: req.query.briefType ? (Array.isArray(req.query.briefType) ? req.query.briefType : [req.query.briefType]) : [],
      location: req.query.location as string,
      propertyType: req.query.propertyType as string,
      priceMin: req.query.priceMin as string,
      priceMax: req.query.priceMax as string,
      isPreference: req.query.isPreference as string,
      buildingType: req.query.buildingType ? (Array.isArray(req.query.buildingType) ? req.query.buildingType : [req.query.buildingType]) : [],
      page: req.query.page as string,
      limit: req.query.limit as string,
    };

    const properties = await adminController.getAllProperties(filters);

    return res.status(200).json({
      success: true,
      data: properties.data.map(formatPropertyDataForTable),
      pagination: {
        total: properties.total,
        currentPage: properties.currentPage,
        totalPages: properties.totalPages,
        perPage: properties.perPage,
      },
    });
  } catch (error) {
    next(error);
  }
});

AdminRouter.get('/agents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '10', search = '', ...filters } = req.query;

    const result = await adminController.getUsersByType({
      userType: 'Agent',
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      search: search as string,
      filters,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

AdminRouter.get('/agents/upgrade-requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '10' } = req.query;

    const result = await adminController.getAllUpgradeRequests(
      Number(page),
      Number(limit)
    );

    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        currentPage: result.currentPage,
        totalPages: Math.ceil(result.total / Number(limit)),
        perPage: Number(limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

AdminRouter.get('/landowners', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '10', search = '', ...filters } = req.query;

    const result = await adminController.getUsersByType({
      userType: 'Landowners',
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      search: search as string,
      filters,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

AdminRouter.get('/agents/:userId', async (req, res, next) => {
  try {
    const result = await adminController.getAgentProfile(req.params.userId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

AdminRouter.get('/landowners/:userId', async (req, res, next) => {
  try {
    const result = await adminController.getLandownerProfile(req.params.userId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

AdminRouter.put('/landowners/:userId/flag-account', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (typeof status !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'status (boolean) is required in the body.',
      });
    }

    const message = await adminController.flagOrUnflagLandowner(userId, status);

    return res.status(200).json({
      success: true,
      message,
    });
  } catch (error) {
    next(error);
  }
});

AdminRouter.post('/agents/approve-agent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId, approved } = req.body;

    if (!agentId || typeof approved !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'agentId and approved (boolean) are required.',
      });
    }

    const message = await adminController.approveAgentOnboarding(agentId, approved);

    return res.status(200).json({
      success: true,
      message,
    });
  } catch (error) {
    next(error);
  }
});

AdminRouter.put('/agents/:agentId/flag-account', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.params;
    const { status } = req.body;

    if (typeof status !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'status (boolean) is required in the body.',
      });
    }

    const message = await adminController.flagOrUnflagAgent(agentId, status);

    return res.status(200).json({
      success: true,
      message,
    });
  } catch (error) {
    next(error);
  }
});

AdminRouter.get('/users/:userId/properties', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { page = '1', limit = '10' } = req.query;

    const result = await adminController.getPropertiesByUser(userId, Number(page), Number(limit));

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
});

AdminRouter.get('/properties/stats', async (req, res, next) => {
  try {
    const stats = await adminController.getPropertyStats();
    return res.status(200).json({ success: true, data: stats });
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
    const { page = '1', limit = '10', ...filters } = req.query;

    const result = await adminController.getAllUsers({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      filters,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});








AdminRouter.post('/properties', authorizeAdmin, async (req: Request, res: Response, next: NextFunction) => {
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
    const { page = '1', limit = '10', type, userType, approved } = req.query;

    const agents = await adminController.getAgents(
      Number(page),
      Number(limit),
      type as string,
      userType as string,
      approved as string
    );

    return res.status(200).json({ success: true, ...agents });
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

//====================================================================
AdminRouter.get('/buyers-with-preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminController.getAllBuyersWithPreferences();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

AdminRouter.get('/preferences/:buyerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminController.getPreferencesByBuyerId(req.params.buyerId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

  
  AdminRouter.get('/submitted-briefs', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userType, isApproved, isRejected, isAvailable, page, limit } = req.query;

      const filters = {
        isApproved: isApproved as string,
        isRejected: isRejected as string,
        isAvailable: isAvailable as string,
        page: page as string,
        limit: limit as string,
      };

      const briefs = await adminController.getSubmittedBriefs(userType as string, filters);

      return res.status(200).json({
        success: true,
        data: briefs.data,
        pagination: {
          total: briefs.total,
          currentPage: briefs.currentPage,
          totalPages: briefs.totalPages,
          perPage: briefs.perPage,
        },
      });
    } catch (error) {
      next(error);
    }
  });


AdminRouter.post('/approve-brief/:briefId', async (req: Request, res: Response) => {
  try {
    const { briefId } = req.params;
    const result = await adminController.approveBrief(briefId);

    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ message: error.message || 'Internal Server Error' });
  }
});

AdminRouter.post('/reject-brief/:briefId', async (req: Request, res: Response) => {
  try {
    const { briefId } = req.params;
    const result = await adminController.rejectBrief(briefId);

    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ message: error.message || 'Internal Server Error' });
  }
});

AdminRouter.get('/approved-briefs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const briefs = await adminController.getApprovedBriefs();
    return res.status(200).json({ success: true, data: briefs });
  } catch (error) {
    next(error);
  }
});

AdminRouter.get('/rejected-briefs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const briefs = await adminController.getRejectedBriefs();
    return res.status(200).json({ success: true, data: briefs });
  } catch (error) {
    next(error);
  }
});

AdminRouter.post('/match-briefs-to-preference', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { preferenceId, briefIds } = req.body;

    const result = await adminController.matchBriefsToPreference(preferenceId, briefIds);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});


AdminRouter.use(AdminInspRouter);

export default AdminRouter;
