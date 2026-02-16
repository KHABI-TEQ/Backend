// General/marketplace: no publicSlug, receiverMode.general → payment to company
import { submitInspectionRequest as submitGeneralInspectionRequest } from "../controllers/public/inspection/inspectionRequest";
import { authenticateBookingCode, getBookingByBookingCode } from "../controllers/Account/fetchBookings";
import BookingController from "../controllers/public/inspection/bookingActions";
import InspectionActionsController from "../controllers/public/inspection/inspectionActions";
import {
  submitInspectionRatingPublic,
  submitInspectionReportPublic,
} from "../controllers/Account/agentRatingReport";
import { Router } from "express";

const inspectRouter = Router();

// Inspection request from main site (marketplace / home) → general flow
inspectRouter.post("/request-inspection", submitGeneralInspectionRequest);

// Buyer rate/report agent after completed inspection (no auth; buyer identified by email in body)
inspectRouter.post("/:inspectionId/rate", submitInspectionRatingPublic);
inspectRouter.post("/:inspectionId/report", submitInspectionReportPublic);

// Submit a new booking request/instant
inspectRouter.post(
  "/book-request",
  BookingController.submitBookingRequest.bind(
    BookingController,
  ),
);

// Process inspection actions - accept, reject, counter
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

// Get inspection history/logs
inspectRouter.get(
  "/:inspectionId/reOpen",
  InspectionActionsController.reopenInspection,
);


/**
 * BOOKINGS 
 */
inspectRouter.post("/bookings/verify-code", authenticateBookingCode);
inspectRouter.post("/bookings/:bookingCode", getBookingByBookingCode);

export default inspectRouter;
