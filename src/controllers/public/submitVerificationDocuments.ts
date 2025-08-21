import { Response, NextFunction } from "express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { AppRequest } from "../../types/express";
import { RouteError } from "../../common/classes";
import { PaystackService } from "../../services/paystack.service";
import { Types } from "mongoose";
import { SystemSettingService } from "../../services/systemSetting.service";

// Map of document names to their corresponding price setting keys
const listDocNames: Record<string, string> = {
  "certificate-of-occupancy": "certificate-of-occupancy_price",
  "deed-of-partition": "deed-of-partition_price",
  "deed-of-assignment": "deed-of-assignment_price",
  "governors-consent": "governors-consent_price",
  "survey-plan": "survey-plan_price",
  "deed-of-lease": "deed-of-lease_price",
};

// Controller to create a document verification request
export const submitDocumentVerification = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { contactInfo, paymentInfo, documentsMetadata } = req.body;

    // Validate required fields
    if (
      !contactInfo?.email ||
      !paymentInfo?.amountPaid ||
      !Array.isArray(documentsMetadata) ||
      documentsMetadata.length === 0
    ) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing required fields.");
    }

    // Validate number of documents
    if (documentsMetadata.length > 2) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "You can only upload a maximum of 2 documents."
      );
    }

    // Calculate expected total amount from document types
    let expectedAmount = 0;
    const docPrices: Record<string, number> = {};

    for (const doc of documentsMetadata) {
      const priceKey = listDocNames[doc.documentType];
      if (!priceKey) {
        docPrices[doc.documentType] = 0; // default to 0 if not found
        continue;
      }

      const setting = await SystemSettingService.getSetting(priceKey);
      // ✅ Extract numeric value properly
      const price = setting ? Number(setting.value) : 0;

      docPrices[doc.documentType] = price;
      expectedAmount += price;
    }

    // Validate payment amount
    if (paymentInfo.amountPaid !== expectedAmount) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        `Invalid payment amount. Expected ${expectedAmount} for ${documentsMetadata.length} document(s).`
      );
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
      documentsMetadata.map((doc) => {
        const docAmount = docPrices[doc.documentType] ?? 0;
        return DB.Models.DocumentVerification.create({
          buyerId: buyer._id,
          docCode,
          amountPaid: docAmount, // ✅ per-document price
          transaction: paymentResponse.transactionId,
          documents: {
            documentType: doc.documentType,
            documentNumber: doc.documentNumber,
            documentUrl: doc.uploadedUrl,
          },
          docType: doc.documentType,
        });
      })
    );

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Verification documents submitted successfully.",
      data: {
        totalExpectedAmount: expectedAmount,
        documentsSubmitted: createdDocs,
        transaction: paymentResponse,
      },
    });
  } catch (error) {
    next(error);
  }
};

