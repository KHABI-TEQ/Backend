import { Response, NextFunction } from "express";
import { Types } from "mongoose";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { DB } from "../..";
import { TransactionRegistrationStatus } from "../../../models/transactionRegistration";
import { generateAndStoreRegistrationCertificate } from "../../../services/transactionRegistrationCertificate.service";
import {
  getLasreraCertificateConfig,
  updateLasreraCertificateConfig,
  ILasreraCertificateConfig,
} from "../../../services/lasreraSettings.service";
import { buildCertificatePreviewPdf } from "../../../services/transactionRegistrationCertificate.service";
import sendEmail from "../../../common/send.email";
import { generalEmailLayout } from "../../../common/emailTemplates/emailLayout";
import { transactionRegistrationCertificateIssuedMail } from "../../../common/emailTemplates/transactionConfirmationMails";
import { buildCertificateDownloadPageUrl } from "../../../common/emailTemplates/transactionReferenceIds";
import {
  buildRegistrationSearchFilter,
  mergeRegistrationFilters,
} from "../../../utils/transactionRegistrationSearch";
import { notifyAllActiveAdmins } from "../../../services/adminNotification.service";
import { PERMISSIONS } from "../../../common/constants/permissions";
import {
  getAllPermissionNamesForAdmin,
  hasAnyPermission,
} from "../../../utils/permissionUtils";
import type { RegistrationEscalationParty } from "../../../models/transactionRegistration";

const KHABITEQ_ESCALATION_PERMISSIONS = [
  PERMISSIONS.KHABITEQ_REGISTRATIONS_VERIFY,
  PERMISSIONS.KHABITEQ_REGISTRATIONS_FORWARD,
];

const LASRERA_ESCALATION_PERMISSIONS = [PERMISSIONS.LASRERA_REGISTRATIONS_REVIEW];

const KHABITEQ_VERIFY_FROM: TransactionRegistrationStatus[] = ["submitted", "pending_completion", "info_requested"];
const KHABITEQ_FORWARD_FROM: TransactionRegistrationStatus[] = ["khabiteq_verified"];
const LASRERA_REVIEW_FROM: TransactionRegistrationStatus[] = ["forwarded_to_lasrera", "info_requested"];

async function loadRegistration(registrationId: string) {
  const lookup = decodeURIComponent(String(registrationId || "")).trim();
  if (/^[a-fA-F0-9]{24}$/.test(lookup)) {
    return DB.Models.TransactionRegistration.findById(lookup);
  }

  const searchFilter = buildRegistrationSearchFilter(lookup);
  if (!searchFilter) return null;

  return DB.Models.TransactionRegistration.findOne(searchFilter);
}

function badStatus(res: Response, message: string) {
  return res.status(HttpStatusCodes.BAD_REQUEST).json({ success: false, message, data: null });
}

/**
 * PATCH /admin/transaction-registrations/:registrationId/verify
 * KHABITEQ validates documents and marks registration ready for LASRERA.
 */
export const verifyTransactionRegistration = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { registrationId } = req.params;
    const { note } = req.body as { note?: string };

    const registration = await loadRegistration(registrationId);
    if (!registration) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Transaction registration not found",
        data: null,
      });
    }

    if (!KHABITEQ_VERIFY_FROM.includes(registration.status)) {
      return badStatus(
        res,
        `Cannot verify registration in status "${registration.status}". Expected submitted, pending_completion, or info_requested.`
      );
    }

    registration.status = "khabiteq_verified";
    registration.khabiteqVerifiedAt = new Date();
    registration.khabiteqVerifiedBy = req.admin?._id;
    registration.workflowNotes = {
      ...(registration.workflowNotes || {}),
      khabiteqVerificationNote: note?.trim() || registration.workflowNotes?.khabiteqVerificationNote,
    };
    await registration.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Registration verified by KHABITEQ",
      data: registration,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /admin/transaction-registrations/:registrationId/forward
 * KHABITEQ forwards a verified registration to LASRERA for review.
 */
export const forwardTransactionRegistrationToLasrera = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { registrationId } = req.params;
    const { note } = req.body as { note?: string };

    const registration = await loadRegistration(registrationId);
    if (!registration) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Transaction registration not found",
        data: null,
      });
    }

    if (!KHABITEQ_FORWARD_FROM.includes(registration.status)) {
      return badStatus(
        res,
        `Cannot forward registration in status "${registration.status}". Registration must be khabiteq_verified first.`
      );
    }

    registration.status = "forwarded_to_lasrera";
    registration.forwardedToLasreraAt = new Date();
    registration.forwardedBy = req.admin?._id;
    if (note?.trim()) {
      registration.workflowNotes = {
        ...(registration.workflowNotes || {}),
        khabiteqVerificationNote: note.trim(),
      };
    }
    await registration.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Registration forwarded to LASRERA",
      data: registration,
    });
  } catch (err) {
    next(err);
  }
};

type LasreraReviewAction = "approve" | "reject" | "request_info";

/**
 * PATCH /admin/transaction-registrations/:registrationId/lasrera-review
 * LASRERA approves, rejects, or requests additional information.
 */
export const lasreraReviewTransactionRegistration = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { registrationId } = req.params;
    const { action, note } = req.body as { action: LasreraReviewAction; note?: string };

    if (!["approve", "reject", "request_info"].includes(action)) {
      return badStatus(res, 'Invalid action. Use "approve", "reject", or "request_info".');
    }

    const registration = await loadRegistration(registrationId);
    if (!registration) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Transaction registration not found",
        data: null,
      });
    }

    if (!LASRERA_REVIEW_FROM.includes(registration.status)) {
      return badStatus(
        res,
        `Cannot review registration in status "${registration.status}". Expected forwarded_to_lasrera or info_requested.`
      );
    }

    registration.lasreraReviewedAt = new Date();
    registration.lasreraReviewedBy = req.admin?._id;
    registration.workflowNotes = {
      ...(registration.workflowNotes || {}),
      lasreraReviewNote: note?.trim() || registration.workflowNotes?.lasreraReviewNote,
    };

    if (action === "approve") {
      registration.status = "approved";
    } else if (action === "reject") {
      registration.status = "rejected";
    } else {
      registration.status = "info_requested";
      registration.workflowNotes.infoRequestMessage = note?.trim() || "Additional information required.";
    }

    await registration.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message:
        action === "approve"
          ? "Registration approved by LASRERA"
          : action === "reject"
            ? "Registration rejected by LASRERA"
            : "Additional information requested",
      data: registration,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /admin/transaction-registrations/:registrationId/issue-certificate
 * LASRERA generates the registration certificate for an approved registration.
 */
export const issueTransactionRegistrationCertificate = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { registrationId } = req.params;

    const registration = await loadRegistration(registrationId);
    if (!registration) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Transaction registration not found",
        data: null,
      });
    }

    if (registration.status === "certificate_issued" && registration.certificateUrl) {
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: "Certificate already issued",
        data: {
          certificateNumber: registration.certificateNumber,
          certificateUrl: registration.certificateUrl,
          status: registration.status,
        },
      });
    }

    if (registration.status !== "approved") {
      return badStatus(
        res,
        `Cannot issue certificate for status "${registration.status}". Registration must be approved first.`
      );
    }

    const result = await generateAndStoreRegistrationCertificate(
      registration,
      req.admin?._id
    );

    // Mark linked platform property as fully registered when applicable
    if (registration.propertyId) {
      await DB.Models.Property.findByIdAndUpdate(registration.propertyId, {
        status: "sold_leased_registered",
      });
    }

    if (registration.buyer?.email) {
      try {
        const clientLink = (process.env.CLIENT_LINK || "").replace(/\/$/, "");
        const downloadPortalUrl = buildCertificateDownloadPageUrl(clientLink);
        const buyerName = registration.buyer.fullName || "Buyer";
        const htmlBody = transactionRegistrationCertificateIssuedMail({
          buyerName,
          registrationId: String(registration._id),
          certificateNumber: result.certificateNumber,
          downloadPortalUrl,
        });
        await sendEmail({
          to: registration.buyer.email,
          subject: "Your LASRERA transaction registration certificate is ready",
          text: `Hello ${buyerName}, your LASRERA registration certificate (${result.certificateNumber}) is ready. Download securely at ${downloadPortalUrl} using your registration reference and buyer email.`,
          html: generalEmailLayout(htmlBody),
        });
      } catch (emailErr) {
        console.error("[transaction-registration] Certificate issued email failed:", emailErr);
      }
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Transaction registration certificate issued",
      data: {
        ...result,
        status: registration.status,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /admin/lasrera/settings
 */
export const getLasreraSettings = async (_req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const config = await getLasreraCertificateConfig();
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "LASRERA certificate settings",
      data: config,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /admin/lasrera/settings
 */
export const updateLasreraSettings = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const body = req.body as Partial<ILasreraCertificateConfig>;
    const config = await updateLasreraCertificateConfig(body);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "LASRERA certificate settings updated",
      data: config,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /admin/lasrera/settings/preview
 * Returns a sample certificate PDF using draft or saved branding settings.
 */
export const previewLasreraCertificate = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const body = (req.body || {}) as Partial<ILasreraCertificateConfig>;
    const saved = await getLasreraCertificateConfig();

    const draft: ILasreraCertificateConfig = {
      logoUrl: body.logoUrl !== undefined ? body.logoUrl : saved.logoUrl,
      stampUrl: body.stampUrl !== undefined ? body.stampUrl : saved.stampUrl,
      signatureUrl:
        body.signatureUrl !== undefined ? body.signatureUrl : saved.signatureUrl,
      signatoryName: body.signatoryName?.trim() || saved.signatoryName,
      signatoryTitle: body.signatoryTitle?.trim() || saved.signatoryTitle,
    };

    const pdfBuffer = await buildCertificatePreviewPdf(draft);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'inline; filename="lasrera-certificate-preview.pdf"'
    );
    return res.status(HttpStatusCodes.OK).send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /admin/transaction-registrations/lasrera-queue
 * Registrations visible to LASRERA reviewers.
 */
export const getLasreraRegistrationQueue = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      page = "1",
      limit = "20",
      status,
      transactionType,
      search,
    } = req.query as {
      page?: string;
      limit?: string;
      status?: string;
      transactionType?: string;
      search?: string;
    };

    const pageNum = Math.max(parseInt(page, 10), 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10), 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const lasreraStatuses: TransactionRegistrationStatus[] = [
      "forwarded_to_lasrera",
      "info_requested",
      "approved",
      "certificate_issued",
      "completed",
      "rejected",
    ];

    const statusFilter =
      status && lasreraStatuses.includes(status as TransactionRegistrationStatus)
        ? { status }
        : { status: { $in: lasreraStatuses } };

    const filter = mergeRegistrationFilters(
      statusFilter,
      transactionType ? { transactionType } : null,
      search ? buildRegistrationSearchFilter(String(search)) : null
    );

    const [registrations, total] = await Promise.all([
      DB.Models.TransactionRegistration.find(filter)
        .sort({ forwardedToLasreraAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select("-paymentReceiptBase64 -buyerIdBase64 -deedsOfAssignmentBase64 -conveyanceBase64")
        .populate("propertyId", "location price briefType propertyType status")
        .lean(),
      DB.Models.TransactionRegistration.countDocuments(filter),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "LASRERA registration queue",
      data: registrations,
      pagination: {
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        limit: limitNum,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /admin/transaction-registrations/khabiteq-queue
 * Registrations pending KHABITEQ verification or forwarding.
 */
export const getKhabiteqRegistrationQueue = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      page = "1",
      limit = "20",
      status,
      transactionType,
      search,
    } = req.query as {
      page?: string;
      limit?: string;
      status?: string;
      transactionType?: string;
      search?: string;
    };

    const pageNum = Math.max(parseInt(page, 10), 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10), 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const khabiteqStatuses: TransactionRegistrationStatus[] = [
      "submitted",
      "pending_completion",
      "info_requested",
      "khabiteq_verified",
    ];

    const statusFilter =
      status && khabiteqStatuses.includes(status as TransactionRegistrationStatus)
        ? { status }
        : { status: { $in: khabiteqStatuses } };

    const filter = mergeRegistrationFilters(
      statusFilter,
      transactionType ? { transactionType } : null,
      search ? buildRegistrationSearchFilter(String(search)) : null
    );

    const [registrations, total] = await Promise.all([
      DB.Models.TransactionRegistration.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select("-paymentReceiptBase64 -buyerIdBase64 -deedsOfAssignmentBase64 -conveyanceBase64")
        .populate("propertyId", "location price briefType propertyType status")
        .lean(),
      DB.Models.TransactionRegistration.countDocuments(filter),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "KHABITEQ registration queue",
      data: registrations,
      pagination: {
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        limit: limitNum,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /admin/transaction-registrations/:registrationId/escalation
 * Cross-party escalation thread between KHABITEQ and LASRERA administrators.
 */
export const postRegistrationEscalation = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { registrationId } = req.params;
    const { message, fromParty } = req.body as {
      message?: string;
      fromParty?: RegistrationEscalationParty;
    };

    const trimmedMessage = String(message || "").trim();
    if (!trimmedMessage) {
      return badStatus(res, "Escalation message is required.");
    }
    if (fromParty !== "khabiteq" && fromParty !== "lasrera") {
      return badStatus(res, "fromParty must be khabiteq or lasrera.");
    }

    const admin = req.admin;
    if (!admin) {
      return res.status(HttpStatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "Authentication required",
        data: null,
      });
    }

    const permissionNames =
      req.permissionNames || (await getAllPermissionNamesForAdmin(admin));
    const allowedPermissions =
      fromParty === "khabiteq" ? KHABITEQ_ESCALATION_PERMISSIONS : LASRERA_ESCALATION_PERMISSIONS;
    if (!hasAnyPermission(admin, allowedPermissions, permissionNames)) {
      return res.status(HttpStatusCodes.FORBIDDEN).json({
        success: false,
        message: "Insufficient permissions to post escalation for this party.",
        data: null,
      });
    }

    const registration = await loadRegistration(registrationId);
    if (!registration) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Transaction registration not found",
        data: null,
      });
    }

    const authorName = [admin.firstName, admin.lastName].filter(Boolean).join(" ").trim() || admin.email;
    const escalationEntry = {
      fromParty,
      message: trimmedMessage,
      authorName,
      createdBy: admin._id,
      createdAt: new Date(),
    };

    registration.escalationMessages = registration.escalationMessages || [];
    registration.escalationMessages.push(escalationEntry);
    await registration.save();

    const partyLabel = fromParty === "khabiteq" ? "KHABITEQ Realty" : "LASRERA";
    void notifyAllActiveAdmins({
      type: "general",
      title: `Registration escalation (${partyLabel})`,
      message: `${authorName} flagged an issue on registration ${String(registration._id).slice(-8).toUpperCase()}: ${trimmedMessage}`,
      meta: {
        registrationId: String(registration._id),
        fromParty,
        escalation: true,
      },
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Escalation message posted",
      data: escalationEntry,
    });
  } catch (err) {
    next(err);
  }
};
