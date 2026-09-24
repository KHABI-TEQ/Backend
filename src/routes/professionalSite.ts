import express from "express";
import multer from "multer";
import {
  getProfessionalSiteBySlug,
  reportProfessionalSite,
  submitProfessionalSiteDocumentVerification,
  submitProfessionalSiteSurveyRequest,
} from "../controllers/public/professionalSitePublic";
import {
  deleteFileFromCloudinary,
  uploadFileToCloudinary,
} from "../controllers/General/UploadFileController";
import { paymentVerification } from "../controllers/public/paymentVerification";

const storage = multer.memoryStorage();
const upload = multer({ storage });

const ProfessionalSiteRouter = express.Router();

ProfessionalSiteRouter.post(
  "/:publicSlug/upload-single-file",
  upload.single("file"),
  uploadFileToCloudinary
);
ProfessionalSiteRouter.delete("/delete-single-file", deleteFileFromCloudinary);

ProfessionalSiteRouter.get("/:publicSlug", getProfessionalSiteBySlug);
ProfessionalSiteRouter.get("/:publicSlug/getData", getProfessionalSiteBySlug);

ProfessionalSiteRouter.post(
  "/:publicSlug/document-verification",
  submitProfessionalSiteDocumentVerification
);
ProfessionalSiteRouter.post(
  "/:publicSlug/survey-request",
  submitProfessionalSiteSurveyRequest
);

ProfessionalSiteRouter.post("/:publicSlug/report", reportProfessionalSite);

ProfessionalSiteRouter.get("/:publicSlug/verify-payment", paymentVerification);

export default ProfessionalSiteRouter;
