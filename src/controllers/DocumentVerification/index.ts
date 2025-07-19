import { RouteError } from "../../common/classes";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import cloudinary from "../../common/cloudinary"
import mime from 'mime-types';
import {verificationGeneralTemplate} from '../../common/email.template';
import sendEmail from '../../common/send.email';


class DocumentVerificationController {
 public async submitDocumentVerification(
  data: {
    fullName: string;
    email: string;
    phoneNumber: string;
    address: string;
    amountPaid: number;
    documentsMetadata: string; // JSON stringified array
  },
  files: { documents: any[]; receipt: any }
) {
  const { fullName, email, phoneNumber, address, amountPaid, documentsMetadata } = data;

  const metadata = JSON.parse(documentsMetadata || '[]');

  const documentFiles = files?.documents || [];
  const receiptFile = files?.receipt?.[0]; // single file

  if (!documentFiles || documentFiles.length === 0 || documentFiles.length > 2) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      'You must upload 1 or 2 documents only'
    );
  }

  if (!receiptFile) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      'Transaction receipt is required'
    );
  }

  if (!Array.isArray(metadata) || metadata.length !== documentFiles.length) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      'Document metadata must match the number of uploaded files'
    );
  }

  // Upload and structure documents
  const structuredDocs: {
    documentType: string;
    documentNumber: string;
    documentUrl: string;
  }[] = [];

  for (let i = 0; i < documentFiles.length; i++) {
    const file = documentFiles[i];
    const meta = metadata[i];

    if (!meta?.documentType || !meta?.documentNumber) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        `Missing metadata for document ${i + 1}`
      );
    }

    const extension = mime.extension(file.mimetype);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e4);
    const fileName = `document-${uniqueSuffix}.${extension}`;
    const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const fileUrl = await cloudinary.uploadFile(base64, fileName, 'verification-documents');

    structuredDocs.push({
      documentType: meta.documentType,
      documentNumber: meta.documentNumber,
      documentUrl: fileUrl,
    });
  }

  // Upload receipt
  const extension = mime.extension(receiptFile.mimetype);
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e4);
  const fileName = `receipt-${uniqueSuffix}.${extension}`;
  const receiptBase64 = `data:${receiptFile.mimetype};base64,${receiptFile.buffer.toString('base64')}`;
  const receiptUrl = await cloudinary.uploadFile(receiptBase64, fileName, 'verification-documents');

  // Save to database
  const record = await DB.Models.DocumentVerification.create({
    fullName,
    email,
    phoneNumber,
    address,
    amountPaid,
    documents: structuredDocs,
    transactionReceipt: receiptUrl,
    status: 'pending',
  });

  const docsList = structuredDocs
  .map(
    (doc, index) => `<li><strong>Document ${index + 1}:</strong> ${doc.documentType} (No: ${doc.documentNumber})</li>`
  )
  .join('');

const htmlBody = verificationGeneralTemplate(`
  <p>Dear ${fullName},</p>

  <p>Thank you for submitting your documents for verification.</p>

  <p>We have received the following:</p>

  <ul>
    <li><strong>Full Name:</strong> ${fullName}</li>
    <li><strong>Phone Number:</strong> ${phoneNumber}</li>
    <li><strong>Address:</strong> ${address}</li>
    <li><strong>Amount Paid:</strong> ₦${amountPaid}</li>
    <li><strong>Transaction Receipt:</strong> Uploaded Successfully</li>
  </ul>

  <p><strong>Document Details:</strong></p>
  <ul>
    ${docsList}
  </ul>

  <p>Your submission is currently under review. We’ll notify you once the process is completed or if any clarification is needed.</p>

  <p>Thank you for choosing our service.</p>
`);

await sendEmail({
    to:record.email,
    subject:"Submission Confirmation: Document Verification Request Received",
    text: htmlBody,
    html: htmlBody,
  });


  return {
    message: 'Document submitted successfully',
    recordId: record._id,
  };
}




public async getVerificationResult(email: string) {
  const docs = await DB.Models.DocumentVerification.find({ email, status: "successful" }).lean();

  if (!docs.length) {
     return {
       resultDocuments:[] 
     }
  }

  // Collect all result documents into one flat array
  const resultDocuments = docs.flatMap((doc) => doc.resultDocuments || []);

  return {
    resultDocuments,
  };
}

 
}


export const documentVerificationController = new DocumentVerificationController();
