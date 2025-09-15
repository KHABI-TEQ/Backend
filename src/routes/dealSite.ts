import express from "express";
import { getDealSiteBySlug } from "../controllers/DealSite/verifyPublicAccessID";
import { getDealSiteProperties } from "../controllers/DealSite/properties/fetchProperties";
import { getSingleDealSiteProperty } from "../controllers/DealSite/properties/getSingleProperty";

const DealSiteRouter = express.Router();

// get and validate deal site
DealSiteRouter.get("/get-data/:publicSlug", getDealSiteBySlug);
 
// fetch all properties of deal sites
DealSiteRouter.get("/:publicSlug/properties", getDealSiteProperties);

// fetch single property of deal sites
DealSiteRouter.get("/:publicSlug/properties/:propertyId", getSingleDealSiteProperty);

// make inspection request
DealSiteRouter.post("/:publicSlug/inspections/makeRequest", getDealSiteBySlug);

// contact us request
DealSiteRouter.post("/:publicSlug/contactUs", getDealSiteBySlug);

// make inspection request
DealSiteRouter.post("/:publicSlug/inspections/makeRequest", getDealSiteBySlug);

export default DealSiteRouter;
