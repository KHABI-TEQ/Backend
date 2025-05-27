import express, { NextFunction, Request, Response } from 'express';
import { buyerController } from '../controllers/Buyer';
import { DB } from '../controllers';

const buyerRouter = express.Router();

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

buyerRouter.get('/inspection/:inspectionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { inspectionId } = req.params;

    const inspectionDetails = await buyerController.getInspection(inspectionId);

    return res.status(200).json({
      success: true,
      data: inspectionDetails,
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

buyerRouter.post('/update-inspection/:inspectionId', async (req: Request, res: Response, next: NextFunction) => {
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
});

export { buyerRouter };
