import { Request, Response, NextFunction } from "express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { AppRequest } from "../../types/express";
import { RouteError } from "../../common/classes";
import sendEmail from "../../common/send.email";
import { generalEmailLayout } from "../../common/emailTemplates/emailLayout";
import { generateVerificationSubmissionEmail } from "../../common/emailTemplates/documentVerificationMails";

// Controller to create a document verification request
export const submitDocumentVerification = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { contactInfo, paymentInfo, documentsMetadata } = req.body;

    if (
      !contactInfo?.fullName ||
      !contactInfo?.email ||
      !contactInfo?.phoneNumber ||
      !contactInfo?.address ||
      !paymentInfo?.amountPaid ||
      !paymentInfo?.receipt ||
      !Array.isArray(documentsMetadata) ||
      documentsMetadata.length === 0
    ) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing required fields.");
    }

    const newDoc = await DB.Models.DocumentVerification.create({
      fullName: contactInfo.fullName,
      email: contactInfo.email,
      phoneNumber: contactInfo.phoneNumber,
      address: contactInfo.address,
      amountPaid: paymentInfo.amountPaid,
      transactionReceipt: paymentInfo.receipt,
      documents: documentsMetadata.map((doc) => ({
        documentType: doc.documentType,
        documentNumber: doc.documentNumber,
        documentUrl: doc.uploadedUrl,
      })),
    });

    const emailPrams = {
        "fullName": contactInfo.fullName,
        "phoneNumber": contactInfo.phoneNumber,
        "address": contactInfo.address,
        "amountPaid": paymentInfo.amountPaid,
        "documents": documentsMetadata
    }

    // Send mail
    const mailBody = generalEmailLayout(
        generateVerificationSubmissionEmail(emailPrams)
    )

   await sendEmail({
    to: contactInfo.email,
    subject: "Document Verification Submission Received – Under Review",
    html: mailBody,
    text: mailBody,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Verification document submitted successfully.",
      data: newDoc,
    });
  } catch (error) {
    next(error);
  }
};
