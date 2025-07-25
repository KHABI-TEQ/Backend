import { Router } from "express";
import {
  getAllProperties,
  getSingleProperty,
} from "../controllers/public/property/fetchProperty";


// Init shared
const propertyRouter = Router();

propertyRouter.get("/all", getAllProperties);
propertyRouter.get("/:propertyId/getOne", getSingleProperty);


export default propertyRouter;
