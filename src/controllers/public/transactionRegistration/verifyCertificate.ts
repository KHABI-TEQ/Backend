import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { DB } from "../..";
import { normalizeTransactionReference } from "../../../services/transactionReference.service";
import {
  toPublicCertificateView,
  toUnauthorizedPartyView,
} from "../../../services/transactionCertificateRecord.service";
import { logCertificateActivity } from "../../../services/transactionCertificateAudit.service";

/**
 * GET /transaction-registration/verify/:reference
 * Public verification. Does not expose private party contact details.
 */
export const verifyTransactionCertificate = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const reference = normalizeTransactionReference(String(req.params.reference || req.query.reference || ""));
    if (!reference) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Provide a transaction reference.",
        data: null,
      });
    }

    const registration = await DB.Models.TransactionRegistration.findOne({
      $or: [{ transactionReference: reference }, { certificateNumber: reference }],
    });

    if (!registration || !registration.transactionReference) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Certificate not found.",
        data: null,
      });
    }

    void logCertificateActivity({
      registrationId: String(registration._id),
      transactionReference: registration.transactionReference,
      actorType: "System",
      action: "CERTIFICATE_VERIFIED",
      meta: { source: "public-verify" },
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Certificate verified",
      data: toUnauthorizedPartyView(registration),
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicCertificateSummary = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const reference = normalizeTransactionReference(String(req.params.reference || ""));
    const registration = await DB.Models.TransactionRegistration.findOne({
      transactionReference: reference,
    }).lean();
    if (!registration) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Certificate not found.",
        data: null,
      });
    }
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: toPublicCertificateView(registration as any),
    });
  } catch (error) {
    next(error);
  }
};
