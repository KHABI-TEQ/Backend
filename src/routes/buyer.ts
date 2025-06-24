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

buyerRouter.post('/request-inspection', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      propertyId,
      inspectionDate,
      inspectionTime,
      status,
      requestedBy,
      transaction,
      isNegotiating,
      negotiationPrice,
      letterOfIntention,
    } = req.body;

    console.log(req.body);
    const inspectionResponse = await buyerController.requestInspection({
      propertyId,
      inspectionDate,
      inspectionTime,
      requestedBy,
      transaction,
      isNegotiating,
      negotiationPrice,
      letterOfIntention,
    });

    return res.status(200).json({
      success: true,
      message: inspectionResponse.message,
    });
  } catch (error) {
    next(error);
  }
});

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


buyerRouter.get(
  '/inspection/:inspectionId',
  // AuthorizeAction,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user as any;
      console.log('user', user);
      const { inspectionId } = req.params;

      const inspectionDetails = await buyerController.getInspection(inspectionId, user._id);

      return res.status(200).json({
        success: true,
        data: inspectionDetails,
      });
    } catch (error) {
      next(error);
    }
  }
);

buyerRouter.post(
  '/update-inspection/:inspectionId',
  AuthorizeAction,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        propertyId,
        inspectionDate,
        inspectionTime,
        requestedBy,
        transaction,
        isNegotiating,
        negotiationPrice,
        letterOfIntention,
        counterOffer,
        countering,
        negotiationRejected,
        status,
      } = req.body;
      const { inspectionId } = req.params;

      console.log(req.body);
      const inspectionResponse = await buyerController.updateInspection(inspectionId, {
        propertyId,
        inspectionDate,
        inspectionTime,
        requestedBy,
        transaction,
        isNegotiating,
        negotiationPrice,
        letterOfIntention,
        status,
        counterOffer,
        countering,
        negotiationRejected,
      });

      return res.status(200).json({
        success: true,
        message: inspectionResponse,
      });
    } catch (error) {
      next(error);
    }
  }
);

export { buyerRouter };
