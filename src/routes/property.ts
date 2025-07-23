import { NextFunction, Response, Router } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import HttpStatusCodes from "../common/HttpStatusCodes";
import validator from "../common/validator";
import AuthorizeAction from "./authorize_action";
import { PropertyController } from "../controllers/Property";
import { DB } from "../controllers";
import { IPropertyDoc } from "../models";
import {
  getAllProperties,
  getSingleProperty,
} from "../controllers/public/property/fetchProperty";

interface Request extends Express.Request {
  user?: any;
  query?: any;
  params?: any;
  body?: any;
}

// Init shared
const propertyRouter = Router();
const propertyControl = new PropertyController();

propertyRouter.get("/all", getAllProperties);
propertyRouter.get("/:propertyId/getOne", getSingleProperty);

propertyRouter.get(
  "/preference",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const preference = await propertyControl.getPrefrence();

      return res.status(HttpStatusCodes.OK).send(preference);
    } catch (error) {
      next(error);
    }
  },
);

/******************************************************************************
 *                      Get single property - "GET /api/properties/:_id"
 ******************************************************************************/

propertyRouter.get(
  "/:_id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { _id } = req.params as ParamsDictionary;
      const property = await propertyControl.getOne(_id);
      if (!property) {
        return res.status(HttpStatusCodes.NOT_FOUND).json({
          error: "Property not found",
        });
      }
      return res.status(HttpStatusCodes.OK).send(property);
    } catch (error) {
      next(error);
    }
  },
);

propertyRouter.post(
  "/search",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // const { page, limit, briefType } = req.query as ParamsDictionary;
      const search = req.body;
      const propertys = await propertyControl.searchProperties(search);
      return res.status(HttpStatusCodes.OK).send(propertys);
    } catch (error) {
      next(error);
    }
  },
);

propertyRouter.post(
  "/preference/new",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        propertyType,
        propertyCondition,
        location,
        briefType,
        price,
        landSize,
        features,
        tenantCriteria,
        areYouTheOwner,
        isAvailable,
        budgetRange,
        pictures,
        isApproved,
        isRejected,
        docOnProperty,
        additionalFeatures,
        buildingType,
        owner,
        additionalInfo,
        budgetMax,
        budgetMin,
        preferenceFeeTransaction,
      } = req.body;
      const response = await propertyControl.addPreference({
        propertyType,
        propertyCondition,
        location,
        briefType,
        price,
        landSize,
        features,
        tenantCriteria,
        areYouTheOwner,
        isAvailable,
        budgetRange,
        pictures,
        isApproved,
        isRejected,
        docOnProperty,
        additionalFeatures,
        buildingType,
        owner: {
          email: owner.email,
          fullName: owner.fullName,
          phoneNumber: owner.phoneNumber,
        },
        additionalInfo,
        budgetMax,
        budgetMin,
        preferenceFeeTransaction,
      });
      return res.status(HttpStatusCodes.CREATED).json(response);
    } catch (error) {
      console.error(error);
      next(error);
    }
  },
);

/******************************************************************************
 *                       Add - "POST /api/properties/new"
 ******************************************************************************/

propertyRouter.use(AuthorizeAction);

propertyRouter.post(
  "/new",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        propertyType,
        propertyCondition,
        location,
        briefType,
        price,
        landSize,
        features,
        tenantCriteria,
        areYouTheOwner,
        isAvailable,
        budgetRange,
        pictures,
        isApproved,
        isRejected,
        docOnProperty,
        additionalFeatures,
        buildingType,
        owner,
        additionalInfo,
      } = req.body;
      const response = await propertyControl.add({
        propertyType,
        propertyCondition,
        location,
        briefType,
        price,
        landSize,
        features,
        tenantCriteria,
        areYouTheOwner,
        isAvailable,
        budgetRange,
        pictures,
        isApproved,
        isRejected,
        docOnProperty,
        additionalFeatures,
        buildingType,
        owner: {
          email: owner.email,
          fullName: owner.fullName,
          phoneNumber: owner.phoneNumber,
        },
        additionalInfo,
      });
      return res.status(HttpStatusCodes.CREATED).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/******************************************************************************
 *                       Update - "PUT /api/properties/:_id"
 ******************************************************************************/

propertyRouter.put(
  "/update/:_id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { _id } = req.params as ParamsDictionary;
      if (!_id) {
        return res.status(HttpStatusCodes.BAD_REQUEST).json({
          error: "Property ID is required",
        });
      }
      const {
        propertyType,
        propertyCondition,
        location,
        briefType,
        price,
        landSize,
        features,
        tenantCriteria,
        areYouTheOwner,
        isAvailable,
        budgetRange,
        pictures,
        isApproved,
        isRejected,
        docOnProperty,
        additionalFeatures,
        buildingType,
        owner,
      } = req.body;

      const user = req.user as any;

      const updated = await propertyControl.update(
        _id,
        {
          propertyType,
          propertyCondition,
          location,
          briefType,
          price,
          landSize,
          features,
          tenantCriteria,
          areYouTheOwner,
          isAvailable,
          budgetRange,
          pictures,
          isApproved,
          isRejected,
          docOnProperty,
          additionalFeatures,
          buildingType,
          owner: {
            email: owner.email,
            fullName: owner.fullName,
            phoneNumber: owner.phoneNumber,
          },
        },
        user,
      );
      return res.status(HttpStatusCodes.OK).json(updated);
    } catch (error) {
      next(error);
    }
  },
);

propertyRouter.get(
  "/mine/all",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any;
      if (!user || !user._id) {
        return res.status(HttpStatusCodes.UNAUTHORIZED).json({
          error: "Unauthorized",
        });
      }
      const properties = await DB.Models.Property.find({
        owner: user._id,
      });
      return res.status(HttpStatusCodes.OK).json(properties);
    } catch (error) {
      next(error);
    }
  },
);

/******************************************************************************
 *                    Delete - "DELETE /api/properties/delete/:_id"
 ******************************************************************************/

propertyRouter.delete(
  "/delete/:_id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { _id } = req.params as ParamsDictionary;
      await propertyControl.delete(_id);
      return res.status(HttpStatusCodes.OK).end();
    } catch (error) {
      next(error);
    }
  },
);

/******************************************************************************
 *                                     Export
 ******************************************************************************/

export default propertyRouter;
