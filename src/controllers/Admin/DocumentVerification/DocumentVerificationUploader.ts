import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { DB } from "../..";
import { RouteError } from "../../../common/classes";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import sendEmail from "../../../common/send.email";
import cloudinary from "../../../common/cloudinary";
import { verificationGeneralTemplate } from "../../../common/email.template";
import { AppRequest } from "../../../types/express";
import { generalEmailLayout } from "../../../common/emailTemplates/emailLayout";
import { generateThirdPartyVerificationEmail } from "../../../common/emailTemplates/documentVerificationMails";

// === Send to Verification Provider ===
export const sendToVerificationProvider = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;
    const { documentId } = req.params;

    const doc = await DB.Models.DocumentVerification.findById(documentId).populate('buyerId');

    if (!doc) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Document Verification record not found");
    }

    // Generate a 6-digit unique code
    const accessCode = Math.floor(100000 + Math.random() * 900000).toString();
    doc.accessCode.token = accessCode;

    const buyerData = doc.buyerId as any;

    // Determine department based on docType
    const hasSurveyPlan = doc.documents.documentType == '"survey-plan"';

    const recipientEmail = hasSurveyPlan
      ? process.env.SURVEY_GENERAL_MAIL // Survey Plan Department
      : process.env.GENERAL_VERIFICATION_MAIL; // General Verification Department

    // Prepare third-party email
    const thirdPartyEmailHTML = generalEmailLayout(
      generateThirdPartyVerificationEmail({
        recipientName: hasSurveyPlan
          ? "Survey Plan Officer"
          : "Verification Officer",
        requesterName: buyerData?.fullName || "",
        message:
          "Please review the submitted documents and confirm verification status.",
        accessCode: accessCode,
        accessLink: `${process.env.CLIENT_LINK}/third-party-verification/${doc._id}`,
      })
    );

    await sendEmail({
      to: recipientEmail,
      subject: hasSurveyPlan
        ? "New Survey Plan Verification Request"
        : "New Document Verification Request",
      html: thirdPartyEmailHTML,
      text: `A new document verification request has been submitted.\n\nAccess Code: ${accessCode}\nAccess Link: ${process.env.CLIENT_LINK}/third-party-verification/${doc._id}`,
    });
    
    res.json({
      success: true,
      data: {
        message: "Verification request sent",
        recordId: doc._id,
      },
    });
   
  } catch (err) {
    next(err);
  }
};

// === Upload Result Documents ===
export const uploadVerificationResult = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { documentId } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "File is required");
    }

    const id = new mongoose.Types.ObjectId(documentId);
    const doc = await DB.Models.DocumentVerification.findById(id).populate('buyerId');
    if (!doc) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Verification not found");
    }

    if (doc.status === "successful") {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "The verification result for this document has already been sent"
      );
    }

    const buyerData = doc.buyerId as any;

    const results: string[] = [];

    for (const file of files) {
      const fileBase64 = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
      const fileUrl = await cloudinary.uploadDoc(fileBase64, "result", "verification-documents");
      results.push(fileUrl);
    }

    doc.resultDocuments = results;
    doc.status = "successful";
    await doc.save();

    const resultLinksHtml = results
      .map((url, i) => `<li><a href="${url}" target="_blank">Result Document ${i + 1}</a></li>`)
      .join("");

    const htmlBody = verificationGeneralTemplate(`
      <p>Dear ${buyerData.fullName},</p>
      <p>We are pleased to inform you that the verification process for your submitted documents has been successfully completed.</p>
      <p>You can find the result documents below:</p>
      <ul>${resultLinksHtml}</ul>
    `);

    await sendEmail({
      to: buyerData.email,
      subject: "Verification Result Uploaded",
      text: htmlBody,
      html: htmlBody,
    });

    res.json({
      success: true,
      data: {
        message: "Result uploaded and sent to user",
        recordId: doc._id,
      },
    });
  } catch (err) {
    next(err);
  }
};
