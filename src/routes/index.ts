import { NextFunction, Request, Response } from "express";
import HttpStatusCodes from "../common/HttpStatusCodes";
import cloudinary from "../common/cloudinary";

import express from "express";
import multer from "multer";
import AdminRouter from "./admin";
import propertyRouter from "./property";
import inspectRouter from "./inspectionRouter";
import PromotionRouter from "./promotions";

import {
  deleteFileFromCloudinary,
  uploadFileToCloudinary,
} from "../controllers/General/UploadFileController";

import { getLatestApprovedTestimonials } from "../controllers/public/testimonial";
import { AuthRouter } from "./auth";
import { preferenceRouter } from "./preference";
import AccountRouter from "./account";
import thirdPartyRouter from "./thirdParty";
import { submitContactForm } from "../controllers/public/contactUs";
import { submitDocumentVerification } from "../controllers/public/submitVerificationDocuments";
import { paymentVerification } from "../controllers/public/paymentVerification";
import { fetchSystemSettings } from "../controllers/public/systemSettings";
import { getAllActiveFeatures, getAllActiveSubscriptionPlans } from "../controllers/Account/Agent/subscriptions";
import DealSiteRouter from "./dealSite";
import { subscribeEmail, unsubscribeEmail } from "../controllers/public/emailSubscribeActions";
import { handleWebhook, verifyWebhook } from "../controllers/public/whatsappWebhookController";

const router = express.Router();

// Configure Multer (Store file in memory before uploading)
const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 * ******************************************************
 * ******************************************************
 * ************ CLOUDINARY UPLOAD ROUTES ****************
 * ******************************************************
 * ******************************************************
 */
router.post(
  "/upload-single-file",
  upload.single("file"),
  uploadFileToCloudinary,
);

router.delete("/delete-single-file", deleteFileFromCloudinary);

// Upload route using Multer to handle binary file
router.post(
  "/upload-image",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res
          .status(HttpStatusCodes.BAD_REQUEST)
          .json({ message: "File is required" });
      }

      const fileFor = req.body.for || "property-image";

      const filFolder =
        fileFor === "property-image" ? "property-images" : "other-images";

      // Convert the buffer to a Base64 string
      const fileBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

      const filename = Date.now() + "-" + fileFor;

      // Upload to Cloudinary
      const uploadImg = await cloudinary.uploadFile(
        fileBase64,
        filename,
        filFolder,
      );

      // console.log(uploadImg);

      return res.status(HttpStatusCodes.OK).json({
        message: "Image uploaded successfully",
        url: uploadImg,
      });
    } catch (error) {
      console.error(error);
      res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({ message: "Internal server error" });
    }
  },
);

router.post(
  "/upload-file",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res
          .status(HttpStatusCodes.BAD_REQUEST)
          .json({ message: "File is required" });
      }

      const fileFor = req.body.for || "property-file";

      const filFolder =
        fileFor === "property-file" ? "property-files" : "other-files";

      // Convert the buffer to a Base64 string
      const fileBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

      const filename =
        Date.now() +
        "-" +
        fileFor +
        "." +
        req.file.originalname.split(".").pop();

      // Upload to Cloudinary
      const uploadImg = await cloudinary.uploadDoc(
        fileBase64,
        filename,
        filFolder,
      );

      // console.log(uploadImg);

      return res.status(HttpStatusCodes.OK).json({
        message: "Image uploaded successfully",
        url: uploadImg,
      });
    } catch (error) {
      console.error(error);
      res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({ message: "Internal server error" });
    }
  },
);
 
router.get("/getSystemSettings", fetchSystemSettings)

// Promotions Routes
router.use("/promotions", PromotionRouter);

router.get("/verify-payment", paymentVerification)
 

router.get("/whatsapp/webhook", verifyWebhook);

router.post("/whatsapp/webhook", handleWebhook);

router.post("/emailSubscription/subscribe", subscribeEmail);

router.post("/emailSubscription/unsubscribe", unsubscribeEmail);
 
// Contact Form
router.post("/submitVerificationDocs", submitDocumentVerification);

// All Properties Routes
router.use("/third-party", thirdPartyRouter);

// All Properties Routes
router.use("/deal-site", DealSiteRouter);

// Contact Form
router.post("/contact-us/submit", submitContactForm);

// Testimonials route
router.get("/testimonials", getLatestApprovedTestimonials);
 
router.get("/subscriptions/plans", getAllActiveSubscriptionPlans);
router.get("/features/getAll", getAllActiveFeatures);

// All Auth Routes
router.use("/auth", AuthRouter);

// All Properties Routes
router.use("/properties", propertyRouter);
 
// All Preferences Routes
router.use("/preferences", preferenceRouter);

// All Inspections Routes
router.use("/inspections", inspectRouter);

// All Acoounts Routes
router.use("/account", AccountRouter);

router.use("/admin", AdminRouter);


// Export the base-router
export default router;
