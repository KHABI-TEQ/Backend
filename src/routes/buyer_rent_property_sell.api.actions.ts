import { NextFunction, Request, Response, Router } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';

import { BuyerOrRentPropertySellController } from '../controllers';
import HttpStatusCodes from '../common/HttpStatusCodes';
import validator from '../common/validator';

// Init shared
const router = Router();
const propertySellControl = new BuyerOrRentPropertySellController();

/******************************************************************************
 *                      Get All propertys - "GET /api/properties/buy/request/all"
 ******************************************************************************/

router.get('/all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = req.query as ParamsDictionary;
    const propertys = await propertySellControl.all(Number(page), Number(limit));
    return res.status(HttpStatusCodes.OK).send(propertys);
  } catch (error) {
    next(error);
  }
});

/******************************************************************************
 *                      Get single property - "GET /api/properties/buy/request/:_id"
 ******************************************************************************/

router.get('/:_id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { _id } = req.params as ParamsDictionary;
    const property = await propertySellControl.getOne(_id);
    if (!property) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        error: 'Property not found',
      });
    }
    return res.status(HttpStatusCodes.OK).send(property);
  } catch (error) {
    next(error);
  }
});

/******************************************************************************
 *                       Add - "POST /api/properties/buy/request/new"
 ******************************************************************************/

router.post('/new', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // const {
    //   propertyType,
    //   location,
    //   price,
    //   docOnProperty,
    //   propertyFeatures,
    //   owner,
    //   areYouTheOwner,
    //   usageOptions,
    //   budgetRange,
    //   pictures,
    // } = validator.validate(req.body, 'propertySellSchema');

    const {
      propertyType,
      location,
      price,
      docOnProperty,
      propertyFeatures,
      owner,
      areYouTheOwner,
      usageOptions,
      budgetRange,
      pictures,
    } = req.body;

    if (!budgetRange)
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        data: 'Budget Range is required',
      });

    const response = await propertySellControl.add({
      propertyType,
      location,
      price,
      docOnProperty,
      propertyFeatures,
      owner,
      areYouTheOwner,
      usageOptions,
      pictures,
      budgetRange,
    });
    return res.status(HttpStatusCodes.CREATED).json(response);
  } catch (error) {
    next(error);
  }
});

/******************************************************************************
 *                       Update - "PUT /api/properties/buy/request/:_id"
 ******************************************************************************/

router.put('/update/:_id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { _id } = req.params as ParamsDictionary;
    if (!_id) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        error: 'Property ID is required',
      });
    }
    // const {
    //   propertyType,
    //   location,
    //   price,
    //   docOnProperty,
    //   propertyFeatures,
    //   owner,
    //   areYouTheOwner,
    //   usageOptions,
    //   pictures,
    //   budgetRange,
    // } = validator.validate(req.body, 'propertySellSchema');

    const {
      propertyType,
      location,
      price,
      docOnProperty,
      propertyFeatures,
      owner,
      areYouTheOwner,
      usageOptions,
      pictures,
      budgetRange,
    } = req.body;

    if (!budgetRange)
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        data: 'Budget Range is required',
      });

    const updated = await propertySellControl.update(_id, {
      propertyType,
      location,
      price,
      docOnProperty,
      propertyFeatures,
      owner,
      areYouTheOwner,
      usageOptions,
      pictures,
      budgetRange,
    });
    return res.status(HttpStatusCodes.OK).json(updated);
  } catch (error) {
    next(error);
  }
});

/******************************************************************************
 *                    Delete - "DELETE /api/properties/buy/request/delete/:_id"
 ******************************************************************************/

router.delete('/delete/:_id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { _id } = req.params as ParamsDictionary;
    await propertySellControl.delete(_id);
    return res.status(HttpStatusCodes.OK).end();
  } catch (error) {
    next(error);
  }
});

router.post('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      propertyType,
      state,
      localGovernment,
      area,
      minPrice,
      maxPrice,
      minBedrooms,
      maxBedrooms,
      usageOptions,
      additionalFeatures,
      // minLandSize,
      // maxLandSize,
      landSize,
    } = validator.validate(req.body, 'propertySellSearchSchema');
    const properties = await propertySellControl.getPropertiesFuzzySearch({
      propertyType,
      state,
      localGovernment,
      area,
      minPrice,
      maxPrice,
      minBedrooms,
      maxBedrooms,
      usageOptions,
      additionalFeatures,
      lanndSize: landSize,
    });
    return res.status(HttpStatusCodes.OK).send(properties);
  } catch (error) {
    next(error);
  }
});

/******************************************************************************
 *                                     Export
 ******************************************************************************/

export default router;
