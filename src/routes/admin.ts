import express, { NextFunction, Request, Response } from 'express';
import { AdminController } from '../controllers/Admin';

const AdminRouter = express.Router();
const adminController = new AdminController();

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
    const { propertyType, ownerType, page, limit } = req.body;
    console.log(propertyType, ownerType, page, limit);
    const properties = await adminController.getProperties(propertyType, ownerType, page, limit);
    return res.status(200).json({ success: true, properties });
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
    const { propertyId, propertyType, status } = req.body;
    const response = await adminController.approveOrDisapproveProperty(propertyType, propertyId, status);
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
    const { page, limit, activeStatus } = req.query;
    const agents = await adminController.getAgents(Number(page), Number(limit), (activeStatus as string) === 'true');
    return res.status(200).json({ success: true, agents });
  } catch (error) {
    next(error);
  }
});

AdminRouter.post('/approve-agent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.body;
    const response = await adminController.approveAgent(agentId);
    return res.status(200).json({ success: true, response });
  } catch (error) {
    next(error);
  }
});

export default AdminRouter;
