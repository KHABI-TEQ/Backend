import inspectionController from '../controllers/inspectionController';
import express, { NextFunction, Response, Router } from 'express';
import { DB } from '../controllers';

const inspectRouter = Router();

// make inspection request
inspectRouter.post(
    '/request-inspection', 
    inspectionController.requestInspection
);

// Validate access for security
inspectRouter.get(
  '/validate-access/:userId/:inspectionId',
  inspectionController.validateInspectionAccess
);
 
// GET /inspection-details/:userID/:inspectionID/:userType
inspectRouter.get(
  '/inspection-details/:userID/:inspectionID/:userType',
  inspectionController.getInspectionDetails,
);

export default inspectRouter;
