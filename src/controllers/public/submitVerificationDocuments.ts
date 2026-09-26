import { Response, NextFunction } from "express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { AppRequest } from "../../types/express";
import { RouteError } from "../../common/classes";
import { Types } from "mongoose";
import { notifyAllActiveAdmins } from "../../services/adminNotification.service";
import { assertLawyerFeeInRange } from "../../services/professionalFee.service";
import {
  assertProfessionalPayoutReady,
  notifyProfessionalOfNewRequest,
} from "../../services/professionalRequest.service";
import {
  inspectionLinkFields,
  loadBuyerFromRequest,
  resolveBuyerInspectionLink,
} from "../../utils/seekerTransactionGate";

export const submitDocumentVerification = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { contactInfo, documentsMetadata, lawyerId, inspectionId } = req.body;

    if (
      !contactInfo?.email ||
      !lawyerId ||
      !Array.isArray(documentsMetadata) ||
      documentsMetadata.length === 0
    ) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Missing required fields (lawyerId, contactInfo, documents)."
      );
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

    const lawyerUser = await DB.Models.User.findById(lawyerId);
    if (!lawyerUser || lawyerUser.userType !== "Lawyer") {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid lawyer selected.");
    }

    const lawyerProfile = await DB.Models.LawyerProfile.findOne({
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
    assertProfessionalPayoutReady(lawyerProfile);
    await assertLawyerFeeInRange(lawyerProfile.verificationFee);

    const expectedAmount = Number(lawyerProfile.verificationFee);
    const assignedLawyerId = new Types.ObjectId(String(lawyerId));

    const authBuyer = await loadBuyerFromRequest(req);
    const buyer =
      authBuyer ||
      (await DB.Models.Buyer.findOneAndUpdate(
        { email: String(contactInfo.email).toLowerCase().trim() },
        {
          $set: {
            fullName: contactInfo.fullName || undefined,
            phoneNumber: contactInfo.phoneNumber || undefined,
          },
          $setOnInsert: {
            email: String(contactInfo.email).toLowerCase().trim(),
          },
        },
        { upsert: true, new: true }
      ));

    const docCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const inspectionLink = await resolveBuyerInspectionLink({
      inspectionId,
      buyerId: String(buyer._id),
    });
    const linkFields = inspectionLinkFields(inspectionLink);

    const createdDocs = await Promise.all(
      documentsMetadata.map((doc: any) => {
        const documentPayload: any = {
          documentType: doc.documentType,
        };
        if (doc.documentNumber) documentPayload.documentNumber = doc.documentNumber;
        if (doc.uploadedUrl) documentPayload.documentUrl = doc.uploadedUrl;

        return DB.Models.DocumentVerification.create({
          buyerId: buyer._id,
          lawyerId: assignedLawyerId,
          docCode,
          amountPaid: expectedAmount,
          documents: documentPayload,
          docType: doc.documentType,
          status: "awaiting-acceptance",
          ...linkFields,
        });
      })
    );

    void notifyAllActiveAdmins({
      type: "document_verification_submitted",
      title: "New document verification request",
      message: `Buyer ${contactInfo.email} submitted document verification (doc code ${docCode}) awaiting lawyer acceptance.`,
      meta: {
        docCode,
        buyerEmail: contactInfo.email,
        lawyerId: String(lawyerId),
        documentIds: createdDocs.map((d) => String(d._id)),
      },
    });

    const firstDocId = String(createdDocs[0]?._id || "");
    const lawyerName =
      `${lawyerUser.firstName || ""} ${lawyerUser.lastName || ""}`.trim() ||
      "Lawyer";

    await notifyProfessionalOfNewRequest({
      kind: "lawyer",
      professionalUserId: String(assignedLawyerId),
      professionalEmail: lawyerUser.email,
      professionalName: lawyerName,
      referenceCode: docCode,
      jobId: firstDocId,
      summary: `Document type(s): ${documentsMetadata
        .map((d: any) => d.documentType)
        .join(", ")}. Fee: ₦${expectedAmount.toLocaleString()}.`,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message:
        "Request submitted. The lawyer will accept or decline. You will be notified when payment is due.",
      data: {
        documents: createdDocs,
        docCode,
        totalExpectedAmount: expectedAmount,
        status: "awaiting-acceptance",
        lawyerId: String(lawyerId),
        payment: null,
        transaction: null,
      },
    });
  } catch (error) {
    next(error);
  }
};
