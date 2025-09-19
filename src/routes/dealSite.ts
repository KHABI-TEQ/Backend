import express from "express";
import { getDealSiteBySlug, getDealSiteSection, getFeaturedProperties } from "../controllers/DealSite/verifyPublicAccessID";
import { getDealSiteProperties } from "../controllers/DealSite/properties/fetchProperties";
import { getSingleDealSiteProperty } from "../controllers/DealSite/properties/getSingleProperty";
import { submitBookingRequest } from "../controllers/DealSite/inspections/bookingActions";
import { submitInspectionRequest } from "../controllers/DealSite/inspections/inpectionActions";
import { reportDealSite } from "../controllers/DealSite/reportDealSite";

const DealSiteRouter = express.Router();

// get and validate deal site 
DealSiteRouter.get("/:publicSlug/getData", getDealSiteBySlug);

// get and validate deal site
DealSiteRouter.get("/:publicSlug/featuredProperties", getFeaturedProperties);

// get and validate deal site
DealSiteRouter.get("/:publicSlug/getSettings/:section", getDealSiteSection);
 
// fetch all properties of deal sites
DealSiteRouter.get("/:publicSlug/properties", getDealSiteProperties);

// fetch single property of deal sites
DealSiteRouter.get("/:publicSlug/properties/:propertyId", getSingleDealSiteProperty);

// make inspection request
DealSiteRouter.post("/:publicSlug/inspections/makeRequest", submitInspectionRequest);

// make booking request
DealSiteRouter.post("/:publicSlug/bookings/makeRequest", submitBookingRequest);

// report dealsite
DealSiteRouter.post("/:publicSlug/reportDealPage", reportDealSite);

export default DealSiteRouter;
