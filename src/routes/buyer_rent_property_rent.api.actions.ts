import { NextFunction, Request, Response, Router } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';

import { BuyerOrRentPropertyRentController } from '../controllers';
import HttpStatusCodes from '../common/HttpStatusCodes';
import validator from '../common/validator';

// Init shared
const router = Router();
const propertyRentControl = new BuyerOrRentPropertyRentController();

/******************************************************************************
 *                      Get All propertys - "GET /api/properties/rents/request/rent/all"
 ******************************************************************************/

router.get('/all', async (req: Request, res: Response) => {
  const { page, limit } = req.query as ParamsDictionary;
  const propertys = await propertyRentControl.all(Number(page), Number(limit));
  return res.status(HttpStatusCodes.OK).send(propertys);
});

/******************************************************************************
 *                      Get single property - "GET /api/properties/rents/request/rent/:_id"
 ******************************************************************************/

router.get('/rent/:_id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { _id } = req.params as ParamsDictionary;
    const property = await propertyRentControl.getOne(_id);
    return res.status(HttpStatusCodes.OK).send(property);
  } catch (error) {
    next(error);
  }
});

/******************************************************************************
 *                       Add - "POST /api/properties/rents/request/rent/add"
 ******************************************************************************/

router.post('/rent/new', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // const {
    //   propertyType,
    //   propertyCondition,
    //   location,
    //   rentalPrice,
    //   noOfBedrooms,
    //   features,
    //   tenantCriteria,
    //   owner,
    //   areYouTheOwner,
    //   budgetRange,
    //   pictures,
    // } = validator.validate(req.body, 'propertyRentSchema');

    const {
      propertyType,
      propertyCondition,
      location,
      rentalPrice,
      noOfBedrooms,
      features,
      tenantCriteria,
      owner,
      areYouTheOwner,
      budgetRange,
      pictures,
    } = req.body;

    if (!budgetRange)
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        data: 'Budget Range is missing',
      });

    const response = await propertyRentControl.add({
      propertyType,
      propertyCondition,
      location,
      rentalPrice,
      noOfBedrooms,
      features,
      tenantCriteria,
      owner,
      areYouTheOwner,
      pictures,
      budgetRange,
    });
    return res.status(HttpStatusCodes.CREATED).json(response);
  } catch (error) {
    next(error);
  }
});

/******************************************************************************
 *                       Update - "PUT /api/properties/rents/request/rent/update/:_id"
 ******************************************************************************/

router.put('/rent/update/:_id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { _id } = req.params as ParamsDictionary;
    if (!_id) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({ message: 'Property ID is required' });
    }
    const {
      propertyType,
      propertyCondition,
      location,
      rentalPrice,
      noOfBedrooms,
      features,
      tenantCriteria,
      owner,
      areYouTheOwner,
      pictures,
      budgetRange,
    } = validator.validate(req.body, 'propertyRentSchema');

    if (!budgetRange)
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        data: 'Budget Range is missing',
      });

    const response = await propertyRentControl.update(_id, {
      propertyType,
      propertyCondition,
      location,
      rentalPrice,
      noOfBedrooms,
      features,
      tenantCriteria,
      owner,
      areYouTheOwner,
      pictures,
    });
    return res.status(HttpStatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
});

/******************************************************************************
 *                    Delete - "DELETE /api/properties/rents/request/rent/delete/:_id"
 ******************************************************************************/

router.delete('/rent/delete/:_id', async (req: Request, res: Response) => {
  const { _id } = req.params as ParamsDictionary;
  await propertyRentControl.delete(_id);
  return res.status(HttpStatusCodes.OK).end();
});

/******************************************************************************
 *                       Get fuzzy search - "POST /api/properties/rents/request/rent/search"
 ******************************************************************************/

router.post('/rent/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // const { propertyType, location, budgetMin, budgetMax, features } = validator.validate(
    //   req.body,
    //   'propertyRentSearchSchema'
    // );
    const {
      propertyType,
      propertyCondition,
      state,
      localGovernment,
      area,
      noOfBedrooms,
      budgetMin,
      budgetMax,
      features,
      tenantCriteria,
      // minLandSize, // min land size
      // maxLandSize, // max land size
      landSize,
    } = req.body;
    const response = await propertyRentControl.getPropertiesFuzzy({
      propertyType,
      propertyCondition,
      state,
      localGovernment,
      area,
      noOfBedrooms,
      budgetMin,
      budgetMax,
      features,
      tenantCriteria,
      landSize,
    });
    return res.status(HttpStatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
});
/******************************************************************************
 *                                     Export
 ******************************************************************************/

export default router;
