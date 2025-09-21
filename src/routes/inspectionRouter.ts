import { submitInspectionRequest } from "../controllers/public/inspection/inspectionRequest";
import { authenticateBookingCode, getBookingByBookingCode } from "../controllers/Account/fetchBookings";
import BookingController from "../controllers/public/inspection/bookingActions";
import InspectionActionsController from "../controllers/public/inspection/inspectionActions";
import { Router } from "express";

const inspectRouter = Router();

// Submit a new inspection request
inspectRouter.post("/request-inspection", submitInspectionRequest);

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
