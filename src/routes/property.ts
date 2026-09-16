import { Router } from "express";
import {
  getAllProperties,
  getRandomProperties,
  getSingleProperty,
  getPropertyByCode,
} from "../controllers/public/property/fetchProperty";
import { getPaginatedMatchedProperties, pullNextMatchedPropertiesBatch } from "../controllers/public/preference/fetchMatchedProperties";

 
// Init shared
const propertyRouter = Router();

propertyRouter.get("/all", getAllProperties);
propertyRouter.get("/featuredProps", getRandomProperties);
propertyRouter.get("/code/:code", getPropertyByCode);
propertyRouter.get("/:propertyId/getOne", getSingleProperty);
propertyRouter.get("/:matchedId/:preferenceId/matches", getPaginatedMatchedProperties);
propertyRouter.post(
  "/:matchedId/:preferenceId/matches/next-batch",
  pullNextMatchedPropertiesBatch
);


export default propertyRouter;
