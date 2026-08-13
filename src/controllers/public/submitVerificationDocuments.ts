import { Response, NextFunction } from "express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { AppRequest } from "../../types/express";
import { RouteError } from "../../common/classes";
import { PaystackService } from "../../services/paystack.service";
import { Types } from "mongoose";
import { SystemSettingService } from "../../services/systemSetting.service";
import { notifyAllActiveAdmins } from "../../services/adminNotification.service";
import {
  assertLawyerFeeInRange,
  getLawyerPlatformChargePercent,
} from "../../services/professionalFee.service";
import sendEmail from "../../common/send.email";
import notificationService from "../../services/notification.service";
import { buildLawyerJobMeta } from "../../utils/notificationDeepLinks";

// Map of document names to their corresponding price setting keys (legacy fallback)
const listDocNames: Record<string, string> = {
  "certificate-of-occupancy": "certificate-of-occupancy_price",
  "deed-of-partition": "deed-of-partition_price",
  "deed-of-assignment": "deed-of-assignment_price",
  "governors-consent": "governors-consent_price",
  "survey-plan": "survey-plan_price",
  "deed-of-lease": "deed-of-lease_price",
  "deed-of-conveyance-or-sale": "deed-of-conveyance-or-sale_price",
  "land-certificate": "land-certificate_price",
};

export const submitDocumentVerification = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { contactInfo, paymentInfo, documentsMetadata, lawyerId } = req.body;

    if (
      !contactInfo?.email ||
      !paymentInfo?.amountPaid ||
      !Array.isArray(documentsMetadata) ||
      documentsMetadata.length === 0
    ) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing required fields.");
    }

    if (documentsMetadata.length > 2) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "You can only upload a maximum of 2 documents."
      );
    }

    for (const doc of documentsMetadata) {
      if (!doc.documentNumber && !doc.uploadedUrl) {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          "Each document must have either a document number or an uploaded file."
        );
      }
    }

    let expectedAmount = 0;
    const docPrices: Record<string, number> = {};
    let lawyerProfile: any = null;
    let assignedLawyerId: Types.ObjectId | undefined;

    if (lawyerId) {
      const lawyerUser = await DB.Models.User.findById(lawyerId);
      if (!lawyerUser || lawyerUser.userType !== "Lawyer") {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid lawyer selected.");
      }
      lawyerProfile = await DB.Models.LawyerProfile.findOne({
        userId: lawyerId,
        isMarketplaceVisible: true,
        kycStatus: "approved",
      });
      if (!lawyerProfile) {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          "Selected lawyer is not available on the marketplace."
        );
      }
      await assertLawyerFeeInRange(lawyerProfile.verificationFee);
      // Marketplace: fee is per submission (not multiplied by doc count)
      expectedAmount = Number(lawyerProfile.verificationFee);
      for (const doc of documentsMetadata) {
        docPrices[doc.documentType] = Math.round(
          expectedAmount / documentsMetadata.length
        );
      }
      assignedLawyerId = new Types.ObjectId(String(lawyerId));
    } else {
      // Legacy fixed platform prices when no lawyer is selected
      for (const doc of documentsMetadata) {
        const priceKey = listDocNames[doc.documentType];
        if (!priceKey) {
          docPrices[doc.documentType] = 0;
          continue;
        }
        const setting = await SystemSettingService.getSetting(priceKey);
        const price = setting ? Number(setting.value) : 0;
        docPrices[doc.documentType] = price;
        expectedAmount += price;
      }
    }

    if (Number(paymentInfo.amountPaid) !== Number(expectedAmount)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        `Invalid payment amount. Expected ${expectedAmount} for ${documentsMetadata.length} document(s).`
      );
    }

    const buyer = await DB.Models.Buyer.findOneAndUpdate(
      { email: contactInfo.email },
      { $setOnInsert: contactInfo },
      { upsert: true, new: true }
    );

    const docCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    let paymentResponse: {
      authorization_url: string;
      reference: string;
      transactionId: any;
    };
    if (lawyerProfile?.paystackSubaccountCode) {
      const platformPct = await getLawyerPlatformChargePercent();
      const platformCharge = Math.round((expectedAmount * platformPct) / 100);
      const publicPageUrl =
        process.env.CLIENT_LINK?.replace(/\/$/, "") || "https://khabiteq.com";
      paymentResponse = await PaystackService.initializeSplitPayment({
        subAccount: lawyerProfile.paystackSubaccountCode,
        publicPageUrl,
        amountCharge: platformCharge,
        email: contactInfo.email,
        amount: expectedAmount,
        fromWho: {
          kind: "Buyer",
          item: new Types.ObjectId(buyer._id as Types.ObjectId),
        },
        transactionType: "document-verification",
        metadata: { lawyerId: String(lawyerId), docCode },
      });
    } else {
      paymentResponse = await PaystackService.initializePayment({
        email: contactInfo.email,
        amount: paymentInfo.amountPaid,
        fromWho: {
          kind: "Buyer",
          item: new Types.ObjectId(buyer._id as Types.ObjectId),
        },
        transactionType: "document-verification",
        metadata: lawyerId ? { lawyerId: String(lawyerId), docCode } : { docCode },
      });
    }

    const createdDocs = await Promise.all(
      documentsMetadata.map((doc: any) => {
        const docAmount = docPrices[doc.documentType] ?? 0;
        const documentPayload: any = {
          documentType: doc.documentType,
        };
        if (doc.documentNumber) documentPayload.documentNumber = doc.documentNumber;
        if (doc.uploadedUrl) documentPayload.documentUrl = doc.uploadedUrl;

        return DB.Models.DocumentVerification.create({
          buyerId: buyer._id,
          ...(assignedLawyerId ? { lawyerId: assignedLawyerId } : {}),
          docCode,
          amountPaid: docAmount,
          transaction: paymentResponse.transactionId,
          documents: documentPayload,
          docType: doc.documentType,
        });
      })
    );

    void notifyAllActiveAdmins({
      type: "document_verification_submitted",
      title: "New document verification request",
      message: `Buyer ${contactInfo.email} submitted ${createdDocs.length} document verification record(s) (doc code ${docCode})${
        lawyerId ? ` assigned to lawyer ${lawyerId}` : ""
      }.`,
      meta: {
        docCode,
        buyerEmail: contactInfo.email,
        lawyerId: lawyerId || null,
        documentIds: createdDocs.map((d) => String(d._id)),
      },
    });

    if (lawyerProfile && assignedLawyerId) {
      const lawyerUser = await DB.Models.User.findById(assignedLawyerId);
      const firstDocId = String(createdDocs[0]?._id || "");
      const jobMeta = firstDocId
        ? buildLawyerJobMeta(firstDocId)
        : {
            source: "system" as const,
            audience: "practitioner" as const,
            screen: "lawyer_job",
            actionPath: "/lawyer/jobs",
          };

      await notificationService.createNotification({
        user: String(assignedLawyerId),
        title: "New document verification assignment",
        message: `A buyer selected you for document verification (code ${docCode}). Open Jobs in the practitioners app.`,
        type: "document",
        meta: { ...jobMeta, docCode },
      });

      if (lawyerUser?.email) {
        void sendEmail({
          to: lawyerUser.email,
          subject: "New document verification assignment",
          text: `A buyer selected you for document verification (code ${docCode}). Open Jobs in the Khabi-Teq Practitioners app — no web link required.`,
          skipBuyerInbox: true,
        });
      }
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Verification documents submitted successfully.",
      data: {
        documents: createdDocs,
        docCode,
        totalExpectedAmount: expectedAmount,
        payment: {
          authorization_url: paymentResponse.authorization_url,
          reference: paymentResponse.reference,
        },
        // Alias for clients that historically read transaction.authorization_url
        transaction: {
          authorization_url: paymentResponse.authorization_url,
          reference: paymentResponse.reference,
        },
        lawyerId: lawyerId || null,
      },
    });
  } catch (error) {
    next(error);
  }
};
