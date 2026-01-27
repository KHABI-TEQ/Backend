import { Response, NextFunction } from "express";
import { AppRequest } from "../../../../types/express";
import { DB } from "../../..";
import HttpStatusCodes from "../../../../common/HttpStatusCodes";
import { RouteError } from "../../../../common/classes";
import sendEmail from "../../../../common/send.email";
import { generalEmailLayout } from "../../../../common/emailTemplates/emailLayout";
import { generateAdminVerificationReportEmail, generateBuyerVerificationReportForBuyer } from "../../../../common/emailTemplates/documentVerificationMails";

/**
 * Verify a document verification access code
 */
export const verifyAccessCode = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { documentId, accessCode } = req.body;

    if (!documentId || !accessCode) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Document ID and access code are required");
    }

    // Find the document by ID
    const docVerification = await DB.Models.DocumentVerification.findById(documentId);

    if (!docVerification) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Document verification record not found");
    }

    // Check if access codes match
    if (docVerification.accessCode?.token !== accessCode) {
      return res.status(HttpStatusCodes.OK).json({
        success: false,
        message: "Invalid access code"
      });
    }

    // Update status to approved if not already approved
    if (docVerification.accessCode.status !== "approved") {
      docVerification.accessCode.status = "approved";
      await docVerification.save();
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Access code verified successfully"
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Fetch document verification details (only if accessCode is approved)
 */
export const getDocumentVerificationDetails = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { documentId } = req.params;

    if (!documentId) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Document verification ID is required");
    }

    const docVerification = await DB.Models.DocumentVerification.findById(documentId)
      .lean();

    if (!docVerification) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Document verification not found");
    }

    // Check access code approval status
    // if (docVerification.accessCode?.status !== "approved") {
    //   throw new RouteError(HttpStatusCodes.FORBIDDEN, "Access code not approved. Please verify the access code first.");
    // }

    // Remove accessCode before sending to client
    const { accessCode, ...safeData } = docVerification;

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Document verification details fetched successfully",
      data: safeData
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Fetch document verification status (to validate the status of an document)
 */
export const getDocumentVerificationStatusDetails = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { documentId } = req.params;

    if (!documentId) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Document verification ID is required");
    }

    const docVerification = await DB.Models.DocumentVerification.findById(documentId)
      .lean();

    if (!docVerification) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Document verification not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Document verification details fetched successfully",
      data:{
        status: docVerification.status
      }
    });
  } catch (err) {
    next(err);
  }
};


 
export const submitVerificationReport_old = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { documentId } = req.params;
    const { report, additionalDocuments } = req.body;

    const docVerification = await DB.Models.DocumentVerification.findById(documentId).populate("buyerId");

    if (!docVerification) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Document verification record not found");
    }

    if (!["registered", "unregistered"].includes(report.status)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Status must be either 'registered' or 'unregistered'");
    }
     
    const formattedReport = {
      originalDocumentType: report.originalDocumentType,
      newDocumentUrl: report.newDocumentUrl,
      description: report.description,
      status: report.status,
      verifiedAt: new Date(),
    };

    docVerification.verificationReports = {
      ...(docVerification.verificationReports),
      ...formattedReport
    };

    docVerification.status = report.status;
    await docVerification.save();

    const buyerData = docVerification.buyerId as any;

    // Send mail to the buyer
    const buyerEmailHTML = generalEmailLayout(
      generateBuyerVerificationReportForBuyer({
        buyerName: buyerData.fullName,
        documentCustomId: docVerification.docCode,
        reports: Array.isArray(docVerification.verificationReports)
          ? docVerification.verificationReports
          : [docVerification.verificationReports],
      })
    );

    await sendEmail({
      to: buyerData?.email,
      subject: `Your Verification Report has been ${formattedReport.status.toUpperCase()}`,
      html: buyerEmailHTML,
      text: buyerEmailHTML
    });


    // Send mail to admin
    const adminEmailHTML = generalEmailLayout(
      generateAdminVerificationReportEmail({
        adminName: "Admin",
        requesterName: buyerData.fullName,
        documentCustomId: buyerData._id,
        report: formattedReport,
        verificationPageLink: `${process.env.ADMIN_CLIENT_LINK}/verify_document/${docVerification.status}/${documentId}`
      })
    );

    await sendEmail({
      to: process.env.DOCUMENT_ADMIN_MAIL,
      subject: `New Verification Report Submitted for Document ${docVerification._id}`,
      html: adminEmailHTML,
      text: `New verification reports submitted for document ${docVerification._id}. Please check the admin panel at ${process.env.ADMIN_CLIENT_LINK}/verify_document/${docVerification.status}/${documentId}`
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Verification reports submitted successfully"
    });
  } catch (err) {
    next(err);
  }
};


export const submitVerificationReport = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { documentId } = req.params;
    const { report, additionalDocuments } = req.body;

    const docVerification = await DB.Models.DocumentVerification
      .findById(documentId)
      .populate("buyerId");

    if (!docVerification) {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        "Document verification record not found"
      );
    }

    if (!report || !report.status) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Report payload is required"
      );
    }

    if (!["registered", "unregistered"].includes(report.status)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Status must be either 'registered' or 'unregistered'"
      );
    }

    // Format report
    const formattedReport = {
      originalDocumentType: report.originalDocumentType,
      newDocumentUrl: report.newDocumentUrl,
      description: report.description,
      status: report.status,
      verifiedAt: new Date(),
      selfVerification: false,
    };

    docVerification.verificationReports = formattedReport;
    docVerification.status = report.status;

    // Handle additional documents (optional)
    if (Array.isArray(additionalDocuments) && additionalDocuments.length > 0) {
      const formattedAdditionalDocs = additionalDocuments.map((doc: any) => ({
        name: doc.name,
        documentFile: doc.documentFile,
        comment: doc.comment,
        uploadedAt: doc.uploadedAt || new Date(),
      }));

      docVerification.additionalDocuments = [
        ...(docVerification.additionalDocuments || []),
        ...formattedAdditionalDocs,
      ];
    }

    await docVerification.save();

    const buyerData = docVerification.buyerId as any;

    // 📧 Buyer email
    const buyerEmailHTML = generalEmailLayout(
      generateBuyerVerificationReportForBuyer({
        buyerName: buyerData.fullName,
        documentCustomId: docVerification.docCode,
        reports: [formattedReport],
        additionalDocuments: docVerification.additionalDocuments,
      })
    );

    await sendEmail({
      to: buyerData.email,
      subject: `Your Verification Report has been ${formattedReport.status.toUpperCase()}`,
      html: buyerEmailHTML,
      text: buyerEmailHTML,
    });

    // 📧 Admin email
    const adminEmailHTML = generalEmailLayout(
      generateAdminVerificationReportEmail({
        adminName: "Admin",
        requesterName: buyerData.fullName,
        documentCustomId: docVerification.docCode,
        report: formattedReport,
        additionalDocuments: docVerification.additionalDocuments,
        verificationPageLink: `${process.env.ADMIN_CLIENT_LINK}/verify_document/${docVerification.status}/${documentId}`,
      })
    );

    await sendEmail({
      to: process.env.DOCUMENT_ADMIN_MAIL,
      subject: `New Verification Report Submitted for Document ${docVerification.docCode}`,
      html: adminEmailHTML,
      text: `New verification report submitted for document ${docVerification.docCode}`,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Verification report submitted successfully",
    });
  } catch (err) {
    next(err);
  }
};


