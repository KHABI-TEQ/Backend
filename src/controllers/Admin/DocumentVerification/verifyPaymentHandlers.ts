import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { AppRequest } from "../../../types/express";
import { verificationGeneralTemplate } from "../../../common/email.template";
import sendEmail from "../../../common/send.email";

export const confirmVerificationPayment = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const documentId = req.params.documentId;

    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid document ID");
    }

    const doc = await DB.Models.DocumentVerification.findById(documentId);
    if (!doc) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Record not found");
    }

    if (doc.status !== "pending") {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Only pending records can be confirmed"
      );
    }

    doc.status = "registered";
    await doc.save();

    res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Verification confirmed successfully",
      recordId: doc._id,
    });
  } catch (err) {
    next(err);
  }
};

export const rejectVerificationPayment = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const documentId = req.params.documentId;

    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid document ID");
    }

    const doc = await DB.Models.DocumentVerification.findById(documentId).populate("buyerId");

    if (!doc) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Record not found");
    }

    if (doc.status !== "pending") {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Only pending records can be unregistered"
      );
    }

    doc.status = "unregistered";
    await doc.save();

    const buyerData = doc.buyerId as any;

    const mailBody = verificationGeneralTemplate(`
      <p>Dear ${buyerData.fullName},</p>

      <p>We are writing to inform you that your recent document verification request has been declined.</p>

      <p>This action was taken due to one or more of the following reasons:</p>
      <ul>
        <li>Your payment could not be confirmed.</li>
        <li>The documents submitted require further review or clarification.</li>
      </ul>

      <p>Kindly review your submission and ensure that:</p>
      <ul>
        <li>Proof of payment is properly uploaded and legible.</li>
        <li>All documents are complete, clear, and accurate.</li>
      </ul>

      <p>You may reinitiate the verification process after making the necessary corrections.</p>

      <p>For further support, please contact our team.</p>
      <p><strong>Reference:</strong> ${buyerData._id}</p>
    `);

    await sendEmail({
      to: buyerData.email,
      subject: "Document Verification Rejected",
      text: mailBody,
      html: mailBody,
    });
 
    res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Verification rejected successfully",
      recordId: doc._id,
    });
  } catch (err) {
    next(err);
  }
};
