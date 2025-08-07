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
    const { contactInfo, paymentInfo, documentsMetadata } = req.body;

    if (
      !contactInfo?.fullName ||
      !contactInfo?.email ||
      !contactInfo?.phoneNumber ||
      !contactInfo?.address ||
      !paymentInfo?.amountPaid ||
      !Array.isArray(documentsMetadata) ||
      documentsMetadata.length === 0
    ) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing required fields.");
    }

    // Create or retrieve the buyer by email
    const buyer = await DB.Models.Buyer.findOneAndUpdate(
      { email: contactInfo.email },
      { $setOnInsert: contactInfo },
      { upsert: true, new: true },
    );

    // Generate payment link
    const paymentResponse = await PaystackService.initializePayment({
      email: contactInfo.email,
      amount: paymentInfo.amountPaid,
      fromWho: {
        kind: "Buyer",
        item: new Types.ObjectId(buyer._id as Types.ObjectId),
      },
      transactionType: "document-verification",
    })

    const newDoc = await DB.Models.DocumentVerification.create({
      fullName: contactInfo.fullName,
      email: contactInfo.email,
      phoneNumber: contactInfo.phoneNumber,
      address: contactInfo.address,
      amountPaid: paymentInfo.amountPaid,
      transaction: paymentResponse.transactionId,
      documents: documentsMetadata.map((doc) => ({
        documentType: doc.documentType,
        documentNumber: doc.documentNumber,
        documentUrl: doc.uploadedUrl,
      })),
    });
 
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Verification document submitted successfully.",
      data: {
        documentSubmitted: newDoc,
        transaction: paymentResponse
      },
    });
  } catch (error) {
    next(error);
  }
};
