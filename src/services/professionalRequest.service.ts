import { Types } from "mongoose";
import { DB } from "../controllers";
import { RouteError } from "../common/classes";
import HttpStatusCodes from "../common/HttpStatusCodes";
import sendEmail from "../common/send.email";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";
import {
  buyerRequestAcceptedPayEmail,
  buyerRequestDeclinedEmail,
  professionalContactsUnlockedEmail,
  professionalNewRequestEmail,
} from "../common/emailTemplates/professionalRequestMails";
import {
  generateVerificationSubmissionEmail,
} from "../common/emailTemplates/documentVerificationMails";
import notificationService from "./notification.service";
import { PaystackService } from "./paystack.service";
import {
  getLawyerPlatformChargePercent,
  getSurveyorPlatformChargePercent,
} from "./professionalFee.service";
import {
  buildBuyerDocumentMeta,
  buildLawyerJobMeta,
  buildSurveyorJobMeta,
} from "../utils/notificationDeepLinks";

export type ProfessionalKind = "lawyer" | "surveyor";

export function assertProfessionalPayoutReady(profile: {
  paystackSubaccountCode?: string | null;
}): void {
  if (!profile?.paystackSubaccountCode) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Connect your bank in Settings first so Paystack can settle payments to you."
    );
  }
}

export function marketplaceSearchRegex(search?: string): RegExp | null {
  const q = String(search || "").trim();
  if (!q) return null;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "i");
}

export async function notifyProfessionalOfNewRequest(params: {
  kind: ProfessionalKind;
  professionalUserId: string;
  professionalEmail?: string;
  professionalName: string;
  referenceCode: string;
  jobId: string;
  summary: string;
}): Promise<void> {
  const kindLabel =
    params.kind === "lawyer" ? "document verification" : "survey";
  const meta =
    params.kind === "lawyer"
      ? buildLawyerJobMeta(params.jobId)
      : buildSurveyorJobMeta(params.jobId);

  await notificationService.createNotification({
    user: params.professionalUserId,
    title:
      params.kind === "lawyer"
        ? "New document verification request"
        : "New survey request",
    message: `A buyer selected you for ${kindLabel} (${params.referenceCode}). Accept or decline in Jobs.`,
    type: params.kind === "lawyer" ? "document" : "survey",
    meta: { ...meta, referenceCode: params.referenceCode },
  });

  if (params.professionalEmail) {
    const html = generalEmailLayout(
      professionalNewRequestEmail({
        professionalName: params.professionalName,
        kindLabel,
        referenceCode: params.referenceCode,
        summary: params.summary,
      })
    );
    void sendEmail({
      to: params.professionalEmail,
      subject: `New ${kindLabel} request – accept in app`,
      html,
      text: `New ${kindLabel} request (${params.referenceCode}). Open Jobs in the Practitioners app.`,
      skipBuyerInbox: true,
    });
  }
}

export async function respondToLawyerRequest(params: {
  jobId: string;
  lawyerUserId: string;
  accept: boolean;
  reason?: string;
}) {
  const job = await DB.Models.DocumentVerification.findOne({
    _id: params.jobId,
    lawyerId: params.lawyerUserId,
  });
  if (!job) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Job not found.");
  }
  if (job.status !== "awaiting-acceptance") {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "This request is no longer awaiting acceptance."
    );
  }

  const profile = await DB.Models.LawyerProfile.findOne({
    userId: params.lawyerUserId,
  });
  if (!profile) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Lawyer profile not found.");
  }

  const lawyer = await DB.Models.User.findById(params.lawyerUserId);
  const lawyerName =
    `${lawyer?.firstName || ""} ${lawyer?.lastName || ""}`.trim() || "Your lawyer";

  if (params.accept) {
    assertProfessionalPayoutReady(profile);
    job.status = "awaiting-payment";
    job.respondedAt = new Date();
    job.declineReason = undefined;
    await job.save();

    const buyer = await DB.Models.Buyer.findById(job.buyerId);
    if (buyer?.email) {
      const html = generalEmailLayout(
        buyerRequestAcceptedPayEmail({
          buyerName: buyer.fullName || "Buyer",
          kindLabel: "document verification",
          professionalName: lawyerName,
          amount: Number(profile.verificationFee || job.amountPaid || 0),
          referenceCode: job.docCode,
        })
      );
      void sendEmail({
        to: buyer.email,
        subject: "Your lawyer accepted – please pay to continue",
        html,
        text: `${lawyerName} accepted your document verification. Pay ₦${Number(profile.verificationFee || 0).toLocaleString()} in the Buyers app.`,
        inboxMeta: buildBuyerDocumentMeta(String(job._id)),
      });
    }
  } else {
    job.status = "declined";
    job.respondedAt = new Date();
    job.declineReason = String(params.reason || "").trim() || undefined;
    await job.save();

    const buyer = await DB.Models.Buyer.findById(job.buyerId);
    if (buyer?.email) {
      const html = generalEmailLayout(
        buyerRequestDeclinedEmail({
          buyerName: buyer.fullName || "Buyer",
          kindLabel: "document verification",
          professionalName: lawyerName,
          reason: job.declineReason,
        })
      );
      void sendEmail({
        to: buyer.email,
        subject: "Document verification request declined",
        html,
        text: `${lawyerName} declined your document verification request.`,
        inboxMeta: buildBuyerDocumentMeta(String(job._id)),
      });
    }
  }

  return job;
}

export async function respondToSurveyorRequest(params: {
  jobId: string;
  surveyorUserId: string;
  accept: boolean;
  reason?: string;
}) {
  const job = await DB.Models.SurveyRequest.findOne({
    _id: params.jobId,
    surveyorId: params.surveyorUserId,
  });
  if (!job) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Job not found.");
  }
  if (job.status !== "awaiting-acceptance") {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "This request is no longer awaiting acceptance."
    );
  }

  const profile = await DB.Models.SurveyorProfile.findOne({
    userId: params.surveyorUserId,
  });
  if (!profile) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Surveyor profile not found."
    );
  }

  const surveyor = await DB.Models.User.findById(params.surveyorUserId);
  const surveyorName =
    `${surveyor?.firstName || ""} ${surveyor?.lastName || ""}`.trim() ||
    "Your surveyor";

  if (params.accept) {
    assertProfessionalPayoutReady(profile);
    job.status = "awaiting-payment";
    job.respondedAt = new Date();
    job.declineReason = undefined;
    await job.save();

    const buyer = await DB.Models.Buyer.findById(job.buyerId);
    if (buyer?.email) {
      const html = generalEmailLayout(
        buyerRequestAcceptedPayEmail({
          buyerName: buyer.fullName || "Buyer",
          kindLabel: "survey",
          professionalName: surveyorName,
          amount: Number(profile.surveyFee || job.amountPaid || 0),
          referenceCode: String(job._id).slice(-8).toUpperCase(),
        })
      );
      void sendEmail({
        to: buyer.email,
        subject: "Your surveyor accepted – please pay to continue",
        html,
        text: `${surveyorName} accepted your survey request. Pay in the Buyers app.`,
        inboxMeta: {
          source: "system",
          audience: "buyer",
          screen: "surveys",
          actionPath: "/surveys",
          surveyRequestId: String(job._id),
        },
      });
    }
  } else {
    job.status = "declined";
    job.respondedAt = new Date();
    job.declineReason = String(params.reason || "").trim() || undefined;
    await job.save();

    const buyer = await DB.Models.Buyer.findById(job.buyerId);
    if (buyer?.email) {
      const html = generalEmailLayout(
        buyerRequestDeclinedEmail({
          buyerName: buyer.fullName || "Buyer",
          kindLabel: "survey",
          professionalName: surveyorName,
          reason: job.declineReason,
        })
      );
      void sendEmail({
        to: buyer.email,
        subject: "Survey request declined",
        html,
        text: `${surveyorName} declined your survey request.`,
        inboxMeta: {
          source: "system",
          audience: "buyer",
          screen: "surveys",
          actionPath: "/surveys",
          surveyRequestId: String(job._id),
        },
      });
    }
  }

  return job;
}

export async function initializeDocumentVerificationPayment(params: {
  jobId: string;
  buyerEmail: string;
}) {
  const email = String(params.buyerEmail || "").toLowerCase().trim();
  const job = await DB.Models.DocumentVerification.findById(params.jobId);
  if (!job) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Request not found.");
  }
  if (job.status !== "awaiting-payment") {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "This request is not ready for payment."
    );
  }
  if (!job.lawyerId) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "No lawyer assigned to this request."
    );
  }

  const buyer = await DB.Models.Buyer.findById(job.buyerId);
  if (!buyer || String(buyer.email || "").toLowerCase() !== email) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "Buyer email does not match this request."
    );
  }

  const profile = await DB.Models.LawyerProfile.findOne({
    userId: job.lawyerId,
    kycStatus: "approved",
    isMarketplaceVisible: true,
  });
  if (!profile) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Lawyer is not available on the marketplace."
    );
  }
  assertProfessionalPayoutReady(profile);

  const amount = Number(profile.verificationFee);
  const platformPct = await getLawyerPlatformChargePercent();
  const platformCharge = Math.round((amount * platformPct) / 100);
  const publicPageUrl =
    process.env.CLIENT_LINK?.replace(/\/$/, "") || "https://khabiteq.com";

  const paymentResponse = await PaystackService.initializeSplitPayment({
    subAccount: profile.paystackSubaccountCode!,
    publicPageUrl,
    amountCharge: platformCharge,
    email,
    amount,
    fromWho: {
      kind: "Buyer",
      item: new Types.ObjectId(buyer._id as Types.ObjectId),
    },
    transactionType: "document-verification",
    metadata: {
      lawyerId: String(job.lawyerId),
      docCode: job.docCode,
      documentVerificationId: String(job._id),
    },
  });

  const txId = new Types.ObjectId(String(paymentResponse.transactionId));
  job.amountPaid = amount;
  job.transaction = txId;
  await job.save();

  // Link any sibling docs with same docCode
  await DB.Models.DocumentVerification.updateMany(
    { docCode: job.docCode, lawyerId: job.lawyerId },
    {
      $set: {
        amountPaid: amount,
        transaction: txId,
      },
    }
  );

  return paymentResponse;
}

export async function initializeSurveyRequestPayment(params: {
  jobId: string;
  buyerEmail: string;
}) {
  const email = String(params.buyerEmail || "").toLowerCase().trim();
  const job = await DB.Models.SurveyRequest.findById(params.jobId);
  if (!job) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Request not found.");
  }
  if (job.status !== "awaiting-payment") {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "This request is not ready for payment."
    );
  }

  const buyer = await DB.Models.Buyer.findById(job.buyerId);
  if (!buyer || String(buyer.email || "").toLowerCase() !== email) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "Buyer email does not match this request."
    );
  }

  const profile = await DB.Models.SurveyorProfile.findOne({
    userId: job.surveyorId,
    kycStatus: "approved",
    isMarketplaceVisible: true,
  });
  if (!profile) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Surveyor is not available on the marketplace."
    );
  }
  assertProfessionalPayoutReady(profile);

  const amount = Number(profile.surveyFee);
  const platformPct = await getSurveyorPlatformChargePercent();
  const platformCharge = Math.round((amount * platformPct) / 100);
  const publicPageUrl =
    process.env.CLIENT_LINK?.replace(/\/$/, "") || "https://khabiteq.com";

  const paymentResponse = await PaystackService.initializeSplitPayment({
    subAccount: profile.paystackSubaccountCode!,
    publicPageUrl,
    amountCharge: platformCharge,
    email,
    amount,
    fromWho: {
      kind: "Buyer",
      item: new Types.ObjectId(buyer._id as Types.ObjectId),
    },
    transactionType: "survey-request",
    metadata: {
      surveyorId: String(job.surveyorId),
      surveyRequestId: String(job._id),
      serviceType: job.serviceType,
    },
  });

  job.amountPaid = amount;
  job.transaction = new Types.ObjectId(String(paymentResponse.transactionId));
  await job.save();

  return paymentResponse;
}

export async function emailProfessionalBuyerContacts(params: {
  kind: ProfessionalKind;
  professionalUserId: Types.ObjectId | string;
  buyer: { fullName?: string; email?: string; phoneNumber?: string };
  referenceCode: string;
  amount: number;
  jobId: string;
}): Promise<void> {
  const user = await DB.Models.User.findById(params.professionalUserId);
  if (!user?.email) return;

  const name =
    `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Professional";
  const kindLabel =
    params.kind === "lawyer" ? "document verification" : "survey";
  const html = generalEmailLayout(
    professionalContactsUnlockedEmail({
      professionalName: name,
      kindLabel,
      referenceCode: params.referenceCode,
      buyerName: params.buyer.fullName || "Buyer",
      buyerEmail: params.buyer.email || "",
      buyerPhone: params.buyer.phoneNumber || "",
      amount: params.amount,
    })
  );

  const meta =
    params.kind === "lawyer"
      ? buildLawyerJobMeta(params.jobId)
      : buildSurveyorJobMeta(params.jobId);

  await notificationService.createNotification({
    user: String(params.professionalUserId),
    title: "Payment received – buyer contacts unlocked",
    message: `${params.buyer.fullName || "Buyer"} paid. Contact them to proceed.`,
    type: params.kind === "lawyer" ? "document" : "survey",
    meta,
  });

  void sendEmail({
    to: user.email,
    subject: `Payment received – buyer contacts for ${kindLabel}`,
    html,
    text: `Payment received. Buyer: ${params.buyer.fullName}, ${params.buyer.email}, ${params.buyer.phoneNumber}`,
    skipBuyerInbox: true,
  });
}

export async function emailBuyerPaymentReceived(params: {
  buyer: { fullName?: string; email?: string; phoneNumber?: string; address?: string };
  amountPaid: number;
  documents: any;
  documentVerificationId: string;
}): Promise<void> {
  if (!params.buyer.email) return;
  const html = generalEmailLayout(
    generateVerificationSubmissionEmail({
      fullName: params.buyer.fullName || "",
      phoneNumber: params.buyer.phoneNumber || "",
      address: params.buyer.address || "",
      amountPaid: params.amountPaid,
      documents: params.documents,
    })
  );
  void sendEmail({
    to: params.buyer.email,
    subject: "Payment received – verification in progress",
    html,
    text: "Your payment was received. Document verification is now in progress.",
    inboxMeta: buildBuyerDocumentMeta(params.documentVerificationId),
  });
}
