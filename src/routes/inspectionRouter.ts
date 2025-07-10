import inspectionController from "../controllers/inspectionController";
import { Router } from "express";

const inspectRouter = Router();

// Submit a new inspection request
inspectRouter.post(
  "/request-inspection",
  inspectionController.submitInspectionRequest
);

// Process inspection actions - accept, reject, counter, request_changes
inspectRouter.post(
  "/inspections/:inspectionId/actions/:userId",
  inspectionController.processInspectionAction,
);

// Validate access for security
inspectRouter.get(
  "/validate-access/:userId/:inspectionId",
  inspectionController.validateInspectionAccess,
);

// GET /inspection-details/:userID/:inspectionID/:userType
inspectRouter.get(
  "/inspection-details/:userID/:inspectionID/:userType",
  inspectionController.getInspectionDetails,
);

// Get all inspections for a user by role
inspectRouter.get(
  "/users/:userId/inspections",
  inspectionController.getUserInspections,
);

// Get inspection history/logs
inspectRouter.get(
  "/inspections/:inspectionId/history",
  inspectionController.getInspectionHistory,
);

export default inspectRouter;
