import express from 'express';
import { AdminInspectionController } from '../controllers/Admin/AdminInspectionController';
import { use } from '../utils/use';


const AdminInspRouter = express.Router();
const controller = new AdminInspectionController();


// Fetch all inspections with optional filters (status, propertyId, etc.)
AdminInspRouter.get('/inspections', use(controller.getAllInspections.bind(controller)));

// Fetch inspection stats
AdminInspRouter.get('/inspections/stats', use(controller.getInspectionStats.bind(controller)));

// Fetch inspection logs
AdminInspRouter.get('/inspection/logs', use(controller.getInspectionLogs.bind(controller)));

// Get a single inspection with full details (buyer, transaction, etc.)
AdminInspRouter.get('/inspections/:id', use(controller.getSingleInspection.bind(controller)));

// attach field agent to an inspection
AdminInspRouter.post('/inspections/:id/attachFieldAgent', use(controller.attachFieldAgentToInspection.bind(controller)));

// remove attached field agent to an inspection
AdminInspRouter.delete('/inspections/:id/removeFieldAgent', use(controller.removeFieldAgentFromInspection.bind(controller)));

// Update or approve an inspection status
AdminInspRouter.patch('/inspections/:id/status', use(controller.updateInspectionStatus.bind(controller)));

// Update or approve or reject LOI document
AdminInspRouter.patch('/inspections/:id/approveOrRejectLOI', use(controller.approveOrRejectLOIDocs.bind(controller)));


export default AdminInspRouter;
