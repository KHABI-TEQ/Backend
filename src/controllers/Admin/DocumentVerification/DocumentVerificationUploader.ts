import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { DB } from "../..";
import { RouteError } from "../../../common/classes";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import sendEmail from "../../../common/send.email";
import cloudinary from "../../../common/cloudinary";
import { verificationGeneralTemplate } from "../../../common/email.template";
import { AppRequest } from "../../../types/express";

// === Send to Verification Provider ===
export const sendToVerificationProvider = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;
    const { documentId } = req.params;
    const id = new mongoose.Types.ObjectId(documentId);

    const doc = await DB.Models.DocumentVerification.findById(id);
    if (!doc) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Verification record not found");
    }

    if (!doc.documents || doc.documents.length === 0) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "No documents found for this record");
    }

    const documentDetailsHtml = doc.documents
      .map((docItem, i) => {
        return `
        <li>
          <strong>Document ${i + 1}:</strong><br />
          Type: ${docItem.documentType}<br />
          Number: ${docItem.documentNumber}<br />
          <a href="${docItem.documentUrl}" target="_blank">View Document</a>
        </li>
      `;
      })
      .join("");

    const providerMailBody = verificationGeneralTemplate(`
      <p>Dear Verification Partner,</p>
      <p>We are reaching out from <strong>Khabiteq Realty</strong> regarding a request to verify the authenticity of the following document(s):</p>
      <ul>${documentDetailsHtml}</ul>
      <p><strong>Reference:</strong> ${doc.customId}</p>
      <p>Please confirm the validity of these documents.</p>
    `);

    await sendEmail({
      to: email,
      subject: "Document Verification Request – Khabiteq Realty",
      text: providerMailBody,
      html: providerMailBody,
    });

    const userMailBody = verificationGeneralTemplate(`
      <p>Dear ${doc.fullName},</p>
      <p>Your documents have been forwarded to our certified verification partners. We’ll notify you once the results are ready.</p>
    `);

    await sendEmail({
      to: doc.email,
      subject: "Your Document Verification is in Progress",
      text: userMailBody,
      html: userMailBody,
    });

    doc.status = "in-progress";
    await doc.save();

    res.json({
      success: true,
      data: {
        message: "Verification documents sent to provider and user notified",
        providerEmail: email,
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
    const doc = await DB.Models.DocumentVerification.findById(id);
    if (!doc) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Verification not found");
    }

    if (doc.status === "successful") {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "The verification result for this document has already been sent"
      );
    }

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
      <p>Dear ${doc.fullName},</p>
      <p>We are pleased to inform you that the verification process for your submitted documents has been successfully completed.</p>
      <p>You can find the result documents below:</p>
      <ul>${resultLinksHtml}</ul>
    `);

    await sendEmail({
      to: doc.email,
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
