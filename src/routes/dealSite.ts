import express from "express";
import { getDealSiteBySlug } from "../controllers/DealSite/verifyPublicAccessID";


const DealSiteRouter = express.Router();

// get and validate deal site
DealSiteRouter.get("/get-data/:publicSlug", getDealSiteBySlug);

// DealSiteRouter.get("/getDocumentDetails/:documentId", getDocumentVerificationDetails);

// DealSiteRouter.post("/submit-report/:documentId", submitVerificationReport);

export default DealSiteRouter;
