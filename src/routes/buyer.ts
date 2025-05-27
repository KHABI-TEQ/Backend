import express, { NextFunction, Request, Response } from 'express';
import { buyerController } from '../controllers/Buyer';

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
      status,
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

export { buyerRouter };
