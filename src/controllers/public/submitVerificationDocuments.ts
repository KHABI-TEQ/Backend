import { Response, NextFunction } from "express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { AppRequest } from "../../types/express";
import { RouteError } from "../../common/classes";
import { PaystackService } from "../../services/paystack.service";
import { Types } from "mongoose";

// Controller to create a document verification request
export const submitDocumentVerification = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { contactInfo, paymentInfo, documentMetadata } = req.body;

    // Validate required fields
    if (
      !contactInfo?.email ||
      !paymentInfo?.amountPaid ||
      !Array.isArray(documentMetadata) ||
      documentMetadata.length === 0
    ) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing required fields.");
    }

    // Create or retrieve the buyer by email
    const buyer = await DB.Models.Buyer.findOneAndUpdate(
      { email: contactInfo.email },
      { $setOnInsert: contactInfo },
      { upsert: true, new: true }
    );

    // Generate a shared docCode for this submission batch
    const docCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Generate payment link
    const paymentResponse = await PaystackService.initializePayment({
      email: contactInfo.email,
      amount: paymentInfo.amountPaid,
      fromWho: {
        kind: "Buyer",
        item: new Types.ObjectId(buyer._id as Types.ObjectId),
      },
      transactionType: "document-verification",
    });

    // Create a record for each document in the metadata array
    const createdDocs = await Promise.all(
      documentMetadata.map((doc) =>
        DB.Models.DocumentVerification.create({
          buyerId: buyer._id,
          docCode,
          amountPaid: paymentInfo.amountPaid,
          transaction: paymentResponse.transactionId,
          documents: {
            documentType: doc.documentType,
            documentNumber: doc.documentNumber,
            documentUrl: doc.uploadedUrl,
          },
          docType: doc.documentType,
        })
      )
    );

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Verification documents submitted successfully.",
      data: {
        documentsSubmitted: createdDocs,
        transaction: paymentResponse,
      },
    });
  } catch (error) {
    next(error);
  }
};
