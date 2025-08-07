import { NextFunction, Request, Response } from "express";
import HttpStatusCodes from "../common/HttpStatusCodes";
import cloudinary from "../common/cloudinary";

import express from "express";
import multer from "multer";
import { DB } from "../controllers";
import AdminRouter from "./admin";
import propertyRouter from "./property";
import { documentVerificationController } from "../controllers/DocumentVerification";
import inspectRouter from "./inspectionRouter";

import {
  deleteFileFromCloudinary,
  uploadFileToCloudinary,
} from "../controllers/General/UploadFileController";

import { getLatestApprovedTestimonials } from "../controllers/public/testimonial";
import { AuthRouter } from "./auth";
import { preferenceRouter } from "./preference";
import AccountRouter from "./account";
import { submitContactForm } from "../controllers/public/contactUs";
import { submitDocumentVerification } from "../controllers/public/submitVerificationDocuments";

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

/**
 * Delete file/image by URL endpoint
 * DELETE /delete-file
 */

//=============================================================
const uploadFields = upload.fields([
  { name: "documents", maxCount: 2 },
  { name: "receipt", maxCount: 1 },
]);

router.post(
  "/submit-docs",
  uploadFields,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result =
        await documentVerificationController.submitDocumentVerification(
          req.body,
          (
            req as Request & {
              files: {
                documents: Express.Multer.File[];
                receipt: Express.Multer.File[];
              };
            }
          ).files,
        );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/verification-result",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.query;
      const result = await documentVerificationController.getVerificationResult(
        email as string,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// router.get("/verify-payment", PaystackService.verifyPayment)

// Contact Form
router.post("/submitVerificationDocs", submitDocumentVerification);

// Contact Form
router.post("/contact-us/submit", submitContactForm);

// Testimonials route
router.get("/testimonials", getLatestApprovedTestimonials);
 
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
