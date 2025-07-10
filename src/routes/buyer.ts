import express, { NextFunction, Response } from 'express';
import { buyerController } from '../controllers/Buyer';
import { DB } from '../controllers';
import AuthorizeAction from './authorize_action';

const buyerRouter = express.Router();

interface Request extends Express.Request {
  user?: any;
  query?: any;
  params?: any;
  body?: any;
}

buyerRouter.get('/all-inspections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inspections = await DB.Models.InspectionBooking.find({}).populate([
      { path: 'propertyId' },
      { path: 'owner', select: 'firstName lastName phoneNumber' },
      { path: 'requestedBy', select: 'fullNumber phoneNumber' },
    ]);

    return res.status(200).json({
      success: true,
      data: inspections,
    });
  } catch (error) {
    next(error);
  }
});


buyerRouter.post('/submit-preference', async (req: Request, res: Response, next:NextFunction) => {
  try {
    const result = await buyerController.submitPreference(req.body);
    return res.status(201).json({
      success: true,
      message: result.message,
      data: result.preference,
    });
  } catch (error) {
    next(error);
  }
});


// ✅ New route to get matched briefs using preferenceId
buyerRouter.get('/brief-matches', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { preferenceId } = req.query;
    if (!preferenceId) {
      return res.status(400).json({ success: false, message: 'Missing preferenceId in query' });
    }

    const briefMatches = await buyerController.getBriefMatchesByPreference(preferenceId as string);

    return res.status(200).json({
      success: true,
      data: briefMatches,
    });
  } catch (error) {
    next(error);
  }
});



// buyerRouter.post(
//   '/update-inspection/:inspectionId',
//   // AuthorizeAction,
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const {
//         propertyId,
//         inspectionDate,
//         inspectionTime,
//         requestedBy,
//         transaction,
//         isNegotiating,
//         negotiationPrice,
//         letterOfIntention,
//         counterOffer,
//         countering,
//         negotiationRejected,
//         status,
//       } = req.body;
//       const { inspectionId } = req.params;

//       console.log(req.body);
//       const inspectionResponse = await buyerController.updateInspection(inspectionId, {
//         propertyId,
//         inspectionDate,
//         inspectionTime,
//         requestedBy,
//         transaction,
//         isNegotiating,
//         negotiationPrice,
//         letterOfIntention,
//         status,
//         counterOffer,
//         countering,
//         negotiationRejected,
//       });

//       return res.status(200).json({
//         success: true,
//         message: inspectionResponse,
//       });
//     } catch (error) {
//       next(error);
//     }
//   }
// );

// // New endpoint for Counter Offer
// buyerRouter.post(
//   '/inspection/:inspectionId/counter-offer',
//   // AuthorizeAction,
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const { inspectionId } = req.params;
//       // Extract specific fields as per frontend payload
//       const { counterOffer, counterDateTimeObj, inspectionDateStatus, message, userId, userType } = req.body;
 
//       const response = await buyerController.counterOffer(
//         inspectionId,
//         counterOffer,
//         userId,
//         userType,
//         inspectionDateStatus,
//         counterDateTimeObj?.selectedDate, // Extract date
//         counterDateTimeObj?.selectedTime, // Extract time
//         message,
//       );
      
//       return res.status(200).json({
//         success: true,
//         message: response,
//       });
//     } catch (error) {
//       next(error);
//     }
//   }
// );

// // New endpoint for Accept Offer
// buyerRouter.put(
//   '/inspection/:inspectionId/accept-offer',
//   // AuthorizeAction,
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const { inspectionId } = req.params;
//       // Extract specific fields as per frontend payload
//       const { counterDateTimeObj, inspectionDateStatus, userId, userType } = req.body;

//       const response = await buyerController.acceptOffer(
//         inspectionId,
//         userId,
//         userType,
//         inspectionDateStatus,
//         counterDateTimeObj?.selectedDate, // Extract date
//         counterDateTimeObj?.selectedTime,  // Extract time
//       );

//       return res.status(200).json({
//         success: true,
//         message: response,
//       });
//     } catch (error) {
//       next(error);
//     }
//   }
// ); 

// // New endpoint for Reject Offer
// buyerRouter.put(
//   '/inspection/:inspectionId/reject-offer',
//   // AuthorizeAction,
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const { inspectionId } = req.params;
//       // Extract specific fields as per frontend payload
//       const { counterDateTimeObj, rejectionReason, inspectionDateStatus, userId, userType } = req.body;

//       const response = await buyerController.rejectOffer(
//         inspectionId,
//         userId,
//         userType,
//         inspectionDateStatus,
//         counterDateTimeObj?.selectedDate, // Extract date
//         counterDateTimeObj?.selectedTime, // Extract time
//         rejectionReason,
//       );

//       return res.status(200).json({
//         success: true,
//         message: response,
//       });
//     } catch (error) {
//       next(error);
//     }
//   }
// );

buyerRouter.use(AuthorizeAction);

// 


export { buyerRouter };
