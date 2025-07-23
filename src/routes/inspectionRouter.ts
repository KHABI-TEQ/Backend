import InspectionActionsController from "../controllers/public/inspection/inspectionActions";
import { Router } from "express";

const inspectRouter = Router();

// Submit a new inspection request
inspectRouter.post(
  "/request-inspection",
  InspectionActionsController.submitInspectionRequest,
);

// Process inspection actions - accept, reject, counter, request_changes
inspectRouter.post(
  "/:inspectionId/actions/:userId",
  InspectionActionsController.processInspectionAction.bind(
    InspectionActionsController,
  ),
);

// Validate access for security
inspectRouter.get(
  "/validate-access/:userId/:inspectionId",
  InspectionActionsController.validateInspectionAccess,
);

// GET /inspection-details/:userID/:inspectionID/:userType
inspectRouter.get(
  "/inspection-details/:userID/:inspectionID/:userType",
  InspectionActionsController.getInspectionDetails,
);

// Get all inspections for a user by role
inspectRouter.get(
  "/users/:userId",
  InspectionActionsController.getUserInspections,
);

// Get inspection history/logs
inspectRouter.get(
  "/:inspectionId/history",
  InspectionActionsController.getInspectionHistory,
);

export default inspectRouter;
