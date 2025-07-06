import express from 'express';
import { AdminInspectionController } from '../controllers/Admin/AdminInspectionController';
import { use } from '../utils/use';


const AdminInspRouter = express.Router();
const controller = new AdminInspectionController();


// Fetch all inspections with optional filters (status, propertyId, etc.)
AdminInspRouter.get('/inspections', use(controller.getAllInspections.bind(controller)));

// Get a single inspection with full details (buyer, transaction, etc.)
AdminInspRouter.get('/inspections/:id', use(controller.getSingleInspection.bind(controller)));

// Update or approve an inspection status
AdminInspRouter.patch('/inspections/:id/status', use(controller.updateInspectionStatus.bind(controller)));

// Fetch inspection stats
AdminInspRouter.get('/inspections/stats', use(controller.getInspectionStats.bind(controller)));

// Fetch inspection logs
AdminInspRouter.get('/inspections/logs', use(controller.getInspectionLogs.bind(controller)));


export default AdminInspRouter;
