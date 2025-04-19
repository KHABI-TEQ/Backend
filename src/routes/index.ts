import { Request, Response } from 'express';
import PropertyRentRouter from './property.rent.api.actions';
import PropertySellRouter from './property.sell.api.actions';
import AgentRouter from './agent.api';
import HttpStatusCodes from '../common/HttpStatusCodes';
import cloudinary from '../common/cloudinary';
import RentPropertyRentRequest from './buyer_rent_property_rent.api.actions';
import BuyPropertySellRequest from './buyer_rent_property_sell.api.actions';

import express from 'express';
import multer from 'multer';
import { DB, PropertyRequestController } from '../controllers';
import { RouteError } from '../common/classes';
import jwt from 'jsonwebtoken';
import AdminRouter from './admin';

const router = express.Router();

// Configure Multer (Store file in memory before uploading)
const storage = multer.memoryStorage();
const upload = multer({ storage });

const propertyRequest = new PropertyRequestController();

// Upload route using Multer to handle binary file
router.post('/upload-image', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({ message: 'File is required' });
    }

    // Convert the buffer to a Base64 string
    const fileBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    const filename = Date.now() + '-' + 'property-image-' + req?.file?.originalname?.replace(/\s+/g, '-').toLowerCase();

    // Upload to Cloudinary
    const uploadImg = await cloudinary.uploadFile(fileBase64, filename, 'property-images');

    console.log(uploadImg);

    return res.status(HttpStatusCodes.OK).json({
      message: 'Image uploaded successfully',
      url: uploadImg,
    });
  } catch (error) {
    console.error(error);
    res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
  }
});

router.post('/property/request-inspection', async (req: Request, res: Response) => {
  try {
    const { propertyId, requestFrom, propertyType } = req.body;

    await propertyRequest.requestProperty({ propertyId, requestFrom, propertyType });

    return res.status(HttpStatusCodes.OK).json({ success: true, message: 'Request sent successfully' });
  } catch (error) {
    console.error(error);
    res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message || 'Internal server error' });
  }
});

router.get('/all/inspection-slots', async (req: Request, res: Response) => {
  try {
    const slots = await DB.Models.InspectionSlot.find({
      slotStatus: 'available',
      slotDate: { $gte: new Date(new Date().setDate(new Date().getDate() + 3)) },
    });
    return res.status(HttpStatusCodes.OK).json({ slots });
  } catch (error) {
    console.error(error);
    res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message || 'Internal server error' });
  }
});

router.post('/property/schedule-inspection', async (req: Request, res: Response) => {
  try {
    const { token, inspectionDate, slotId, inspectionTime } = req.body;

    if (!token || !inspectionDate)
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Token and inspection date are required');

    const { requestId } = jwt.verify(token, process.env.JWT_SECRET) as any;

    if (!requestId) throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid token');

    const response = await propertyRequest.scheduleInspection(requestId, inspectionDate, slotId, inspectionTime);

    return res.status(HttpStatusCodes.OK).json(response);
  } catch (error) {
    console.error(error);
    res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message || 'Internal server error' });
  }
});

// Add sub-routes
router.use('/admin', AdminRouter);
router.use('/agent', AgentRouter);
router.use('/properties/rents', PropertyRentRouter);
router.use('/properties/sell', PropertySellRouter);
router.use('/properties/buy/request', BuyPropertySellRequest);
router.use('/properties/rent/request', RentPropertyRentRequest);

// Add one more middleware namely `authorize` after passport.authenticate to authorize user for access
// console `req.user` and `req` in authorize middleware
// router.use('/property-rent', passport.authenticate('jwt', {session: false}), PropertyRentRouter);

// Export the base-router
export default router;
