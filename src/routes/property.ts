import { Router } from "express";
import {
  getAllProperties,
  getSingleProperty,
} from "../controllers/public/property/fetchProperty";
import { getPaginatedMatchedProperties } from "../controllers/public/preference/fetchMatchedProperties";


// Init shared
const propertyRouter = Router();

propertyRouter.get("/all", getAllProperties);
propertyRouter.get("/:propertyId/getOne", getSingleProperty);
propertyRouter.get("/:matchedId/:preferenceId/matches", getPaginatedMatchedProperties);


export default propertyRouter;
