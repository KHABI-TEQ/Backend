import express, { NextFunction, Response } from "express";
import { getDocumentVerificationDetails, submitVerificationReport, verifyAccessCode } from "../controllers/public/thirdParty/documentVerification/documetAcess";

const ThirdPartyRouter = express.Router();


ThirdPartyRouter.post("/verifyAccessCode", verifyAccessCode);

ThirdPartyRouter.get("/getDocumentDetails/:documentId", getDocumentVerificationDetails);

ThirdPartyRouter.post("/submit-report/:documentId", submitVerificationReport);

export default ThirdPartyRouter;
