import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { DB } from "../..";
import { RouteError } from "../../../common/classes";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import sendEmail from "../../../common/send.email";
import { verificationGeneralTemplate } from "../../../common/email.template";
import { AppRequest } from "../../../types/express";
import { generalEmailLayout } from "../../../common/emailTemplates/emailLayout";
import { generateThirdPartyVerificationEmail } from "../../../common/emailTemplates/documentVerificationMails";
import { SystemSettingService } from "../../../services/systemSetting.service";

// === Send to Verification Provider ===
export const sendToVerificationProvider = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
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
    const docType = (doc.documents.documentType || doc.docType).toLowerCase().trim();
 
    // Construct the setting key dynamically
    const settingKey = `${docType}_verification_email`;

    let recipientEmail =
      (await SystemSettingService.getSetting(settingKey))?.value ||
      process.env.GENERAL_VERIFICATION_MAIL; // fallback
    
    // Prepare third-party email
    const thirdPartyEmailHTML = generalEmailLayout(
      generateThirdPartyVerificationEmail({
        recipientName: docType === "survey-plan"
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
      subject: docType === "survey-plan"
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

// === Admin Document Verification (Registered / Unregistered + Report) ===
export const adminDocumentVerification = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { documentId } = req.params;
    const { verificationReport } = req.body;

    if (!["registered", "unregistered"].includes(verificationReport.status)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Status must be either 'registered' or 'unregistered'"
      );
    }
 
    const id = new mongoose.Types.ObjectId(documentId);
    const doc = await DB.Models.DocumentVerification.findById(id).populate("buyerId");
    if (!doc) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Verification not found");
    }

    if (["registered", "unregistered"].includes(doc.status)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "This document has already been verified by Admin"
      );
    }

    const buyerData = doc.buyerId as any;

    // Update status and report
    doc.status = verificationReport.status;
    doc.verificationReports = {
      ...(doc.verificationReports || {}),
      originalDocumentType: verificationReport?.originalDocumentType || doc.documents.documentType,
      description: verificationReport?.description,
      status: verificationReport.status,
      verifiedAt: new Date(),
      selfVerification: true,
    };

    await doc.save();

    // Email body
    const htmlBody = verificationGeneralTemplate(`
      <p>Dear ${buyerData.fullName},</p>
      <p>Your submitted document has been reviewed and marked as <strong>${verificationReport.status.toUpperCase()}</strong> by our Admin team.</p>
      ${
        verificationReport?.description
          ? `<p><strong>Verification Report:</strong> ${verificationReport.description}</p>`
          : ""
      }
    `);

    await sendEmail({
      to: buyerData.email,
      subject: `Document Verification Result - ${verificationReport.status.toUpperCase()}`,
      text: htmlBody,
      html: htmlBody,
    });

    res.json({
      success: true,
      data: {
        message: `Admin verification completed. Document marked as ${verificationReport.status}`,
        recordId: doc._id,
      },
    });
  } catch (err) {
    next(err);
  }
};


