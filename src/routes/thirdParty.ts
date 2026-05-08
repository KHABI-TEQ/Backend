import express, { NextFunction, Response } from "express";
import { getDocumentVerificationDetails, getDocumentVerificationStatusDetails, submitVerificationReport, verifyAccessCode } from "../controllers/public/thirdParty/documentVerification/documetAcess";
import {
  receiveSyndicationWebhook,
  redirectSyndicationInspection,
} from "../controllers/public/thirdParty/syndication/syndicationWebhook";

const ThirdPartyRouter = express.Router();


ThirdPartyRouter.post("/verifyAccessCode", verifyAccessCode);

ThirdPartyRouter.get("/getDocumentDetails/:documentId", getDocumentVerificationDetails);

ThirdPartyRouter.get("/getDocumentDetails/:documentId/status", getDocumentVerificationStatusDetails);

ThirdPartyRouter.post("/submit-report/:documentId", submitVerificationReport);

// Syndication webhooks from partner listing platforms.
ThirdPartyRouter.post("/syndication/webhooks/:platformKey", receiveSyndicationWebhook);

// Signed redirect used as inspection URL in outbound listing payloads.
ThirdPartyRouter.get("/syndication/inspection-redirect/:propertyId", redirectSyndicationInspection);

export default ThirdPartyRouter;
