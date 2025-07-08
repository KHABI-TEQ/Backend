import { RouteError } from "../../common/classes";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import cloudinary from "../../common/cloudinary"

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

    const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const fileUrl = await cloudinary.uploadFile(base64, `document-${i + 1}`, 'verification-documents');

    structuredDocs.push({
      documentType: meta.documentType,
      documentNumber: meta.documentNumber,
      documentUrl: fileUrl,
    });
  }

  // Upload receipt
  const receiptBase64 = `data:${receiptFile.mimetype};base64,${receiptFile.buffer.toString('base64')}`;
  const receiptUrl = await cloudinary.uploadFile(receiptBase64, 'receipt', 'verification-documents');

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
