import express from "express";
import { getDealSiteBySlug, getDealSiteSection, getFeaturedProperties } from "../controllers/DealSite/verifyPublicAccessID";
import { getDealSiteProperties } from "../controllers/DealSite/properties/fetchProperties";
import { getSingleDealSiteProperty } from "../controllers/DealSite/properties/getSingleProperty";
import { submitBookingRequest } from "../controllers/DealSite/inspections/bookingActions";
import multer from "multer";
import { submitInspectionRequest } from "../controllers/DealSite/inspections/inpectionActions";
import { reportDealSite } from "../controllers/DealSite/reportDealSite";
import { deleteFileFromCloudinary, uploadFileToCloudinary } from "../controllers/General/UploadFileController";
import { paymentVerification } from "../controllers/public/paymentVerification";
import { createDealSiteContactUs } from "../controllers/DealSite/otherActions";
import { subscribeEmailDealSite } from "../controllers/public/emailSubscribeActions";
import { sendPreferenceRequest } from "../controllers/DealSite/submitPreference";

// Configure Multer (Store file in memory before uploading)
const storage = multer.memoryStorage();
const upload = multer({ storage });

const DealSiteRouter = express.Router();

// upload file
DealSiteRouter.post(
    "/:publicSlug/upload-single-file",
    upload.single("file"),
    uploadFileToCloudinary,
);

DealSiteRouter.delete("/delete-single-file", deleteFileFromCloudinary);
 
// get and validate deal site 
DealSiteRouter.get("/:publicSlug/getData", getDealSiteBySlug);
 
// get and validate deal site
DealSiteRouter.get("/:publicSlug/featuredProperties", getFeaturedProperties);

// get and validate deal site
DealSiteRouter.get("/:publicSlug/getSettings/:sectionName", getDealSiteSection);

// fetch all properties of deal sites
DealSiteRouter.get("/:publicSlug/properties", getDealSiteProperties);

// fetch single property of deal sites
DealSiteRouter.get("/:publicSlug/properties/:propertyId", getSingleDealSiteProperty);

// make inspection request 
DealSiteRouter.post("/:publicSlug/inspections/makeRequest", submitInspectionRequest);

// make booking request
DealSiteRouter.post("/:publicSlug/bookings/makeRequest", submitBookingRequest);

// verify payment
DealSiteRouter.get("/:publicSlug/verify-payment", paymentVerification);

// contact us
DealSiteRouter.post("/:publicSlug/contactUs", createDealSiteContactUs);

// Submit Preferences
DealSiteRouter.post("/:publicSlug/submit-preference", sendPreferenceRequest);

// Subscribe to public access page newsletter
DealSiteRouter.post("/:publicSlug/newsletter/subscribe", subscribeEmailDealSite);
 
// report public access page
DealSiteRouter.post("/:publicSlug/reportDealPage", reportDealSite);

export default DealSiteRouter;
