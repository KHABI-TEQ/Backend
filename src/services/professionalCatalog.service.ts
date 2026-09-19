import { Types } from "mongoose";
import { DB } from "../controllers";
import { RouteError } from "../common/classes";
import HttpStatusCodes from "../common/HttpStatusCodes";
import {
  CATALOG_AUTO_MATCH_NOTE,
  CATALOG_PAYMENT_NOTE,
  PROFESSIONAL_SERVICE_CATALOG,
  getCatalogService,
  publicCatalogCard,
  type ProfessionalServiceDefinition,
} from "../common/constants/professionalServiceCatalog";
import { notifyAllActiveAdmins } from "./adminNotification.service";
import {
  assertProfessionalPayoutReady,
  emailProfessionalBuyerContacts,
} from "./professionalRequest.service";
import { PaystackService } from "./paystack.service";
import sendEmail from "../common/send.email";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";
import { buyerRequestAcceptedPayEmail } from "../common/emailTemplates/professionalRequestMails";
import {
  broadcastNewServiceRequest,
  flagUnclaimedCatalogRequests,
  isProfessionalEligibleForRequest,
  notifyRequestTaken,
  surveyorJobTypeForSlug,
} from "./professionalAutoMatch.service";
import type {
  IProfessionalServiceRequestDoc,
} from "../models/professionalServiceRequest";
import { buildBuyerDocumentMeta } from "../utils/notificationDeepLinks";

function newReference(): string {
  return `KHT-PS-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

function collectDocumentUrls(answers: Record<string, unknown>): string[] {
  return Object.values(answers)
    .map((v) => String(v || "").trim())
    .filter((v) => /^https?:\/\//i.test(v));
}

function validateAnswers(
  service: ProfessionalServiceDefinition,
  answers: Record<string, unknown>
): void {
  for (const field of service.requiredFields) {
    if (!field.required) continue;
    const value = answers[field.key];
    if (value === undefined || value === null || String(value).trim() === "") {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        `${field.label} is required.`
      );
    }
  }
}

export function listProfessionalServiceCatalog() {
  return {
    paymentNote: CATALOG_PAYMENT_NOTE,
    autoMatchNote: CATALOG_AUTO_MATCH_NOTE,
    disclaimer:
      "Khabiteq facilitates the digital journey. The first eligible professional to accept remains responsible for delivering the service.",
    services: PROFESSIONAL_SERVICE_CATALOG.map(publicCatalogCard),
  };
}

export function getProfessionalServiceBySlug(slug: string) {
  const service = getCatalogService(slug);
  if (!service) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Service not found.");
  }
  return {
    paymentNote: CATALOG_PAYMENT_NOTE,
    autoMatchNote: CATALOG_AUTO_MATCH_NOTE,
    service: publicCatalogCard(service),
  };
}

async function upsertBuyer(contact: {
  fullName: string;
  email: string;
  phoneNumber?: string;
}) {
  const email = String(contact.email || "").toLowerCase().trim();
  if (!email || !contact.fullName?.trim()) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Full name and email are required."
    );
  }
  return DB.Models.Buyer.findOneAndUpdate(
    { email },
    {
      $set: {
        fullName: contact.fullName.trim(),
        phoneNumber: contact.phoneNumber || undefined,
      },
      $setOnInsert: { email },
    },
    { upsert: true, new: true }
  );
}

export async function createProfessionalServiceRequest(body: {
  slug: string;
  contact: { fullName: string; email: string; phoneNumber?: string };
  answers?: Record<string, unknown>;
}) {
  const service = getCatalogService(body.slug);
  if (!service) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Service not found.");
  }
  if (service.comingSoon) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "This service is not yet available. Phase 1 digital services are open now."
    );
  }

  const answers = body.answers || {};
  validateAnswers(service, answers);
  const buyer = await upsertBuyer(body.contact);

  const platformFee = Math.round(
    (service.customerPrice * service.platformFeePercent) / 100
  );
  const professionalFee = service.customerPrice - platformFee;
  const documentUrls = collectDocumentUrls(answers);
  const reference = newReference();

  const request = await DB.Models.ProfessionalServiceRequest.create({
    reference,
    slug: service.slug,
    serviceName: service.name,
    category: service.category,
    fulfillment: service.fulfillment,
    buyerId: buyer._id,
    contact: {
      fullName: body.contact.fullName.trim(),
      email: String(body.contact.email).toLowerCase().trim(),
      phoneNumber: body.contact.phoneNumber,
    },
    answers,
    documentUrls,
    customerPrice: service.customerPrice,
    platformFee,
    professionalFee,
    status: "awaiting-acceptance",
  });

  const offered = await broadcastNewServiceRequest(request);
  void flagUnclaimedCatalogRequests();

  void notifyAllActiveAdmins({
    type: "general",
    title: "New paid professional service request",
    message: `${body.contact.email} requested ${service.name} (${reference}). ${offered.length} professional(s) notified.`,
    meta: {
      reference,
      slug: service.slug,
      requestId: String(request._id),
      category: service.category,
      offeredCount: offered.length,
    },
  });

  return {
    request,
    service: publicCatalogCard(service),
    nextStep: CATALOG_AUTO_MATCH_NOTE,
  };
}

export async function initializeCatalogRequestPayment(params: {
  requestId: string;
  email: string;
}) {
  const email = String(params.email || "").toLowerCase().trim();
  const request = await DB.Models.ProfessionalServiceRequest.findById(
    params.requestId
  );
  if (!request) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Request not found.");
  }
  if (String(request.contact.email).toLowerCase() !== email) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "Email does not match this request."
    );
  }
  if (!request.professionalId) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "A professional must accept this request before payment."
    );
  }
  if (
    request.status !== "awaiting-payment" &&
    request.status !== "payment-failed"
  ) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "This request is not ready for payment."
    );
  }

  const buyer = await DB.Models.Buyer.findById(request.buyerId);
  if (!buyer) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Buyer record not found.");
  }

  const publicPageUrl =
    process.env.CLIENT_LINK?.replace(/\/$/, "") || "https://khabiteq.com";
  const metadata = {
    professionalServiceRequestId: String(request._id),
    reference: request.reference,
    slug: request.slug,
    linkedDocumentVerificationId: request.linkedDocumentVerificationId
      ? String(request.linkedDocumentVerificationId)
      : undefined,
    linkedSurveyRequestId: request.linkedSurveyRequestId
      ? String(request.linkedSurveyRequestId)
      : undefined,
  };

  let payment: {
    transactionId: unknown;
    authorization_url?: string;
    reference?: string;
  };
  if (request.category === "lawyer") {
    const profile = await DB.Models.LawyerProfile.findOne({
      userId: request.professionalId,
      kycStatus: "approved",
      isMarketplaceVisible: true,
    });
    if (!profile) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Assigned professional is not available on the marketplace."
      );
    }
    assertProfessionalPayoutReady(profile);
    payment = await PaystackService.initializeSplitPayment({
      subAccount: profile.paystackSubaccountCode!,
      publicPageUrl,
      amountCharge: request.platformFee,
      email,
      amount: request.customerPrice,
      fromWho: {
        kind: "Buyer",
        item: new Types.ObjectId(buyer._id as Types.ObjectId),
      },
      transactionType: "professional-service",
      metadata,
    });
  } else if (request.category === "surveyor") {
    const profile = await DB.Models.SurveyorProfile.findOne({
      userId: request.professionalId,
      kycStatus: "approved",
      isMarketplaceVisible: true,
    });
    if (!profile) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Assigned professional is not available on the marketplace."
      );
    }
    assertProfessionalPayoutReady(profile);
    payment = await PaystackService.initializeSplitPayment({
      subAccount: profile.paystackSubaccountCode!,
      publicPageUrl,
      amountCharge: request.platformFee,
      email,
      amount: request.customerPrice,
      fromWho: {
        kind: "Buyer",
        item: new Types.ObjectId(buyer._id as Types.ObjectId),
      },
      transactionType: "professional-service",
      metadata,
    });
  } else {
    payment = await PaystackService.initializePayment({
      email,
      amount: request.customerPrice,
      fromWho: {
        kind: "Buyer",
        item: new Types.ObjectId(buyer._id as Types.ObjectId),
      },
      transactionType: "professional-service",
      metadata,
      callbackUrl: `${publicPageUrl}/payment-verification`,
    });
  }

  const txId = new Types.ObjectId(String(payment.transactionId));
  request.transaction = txId;
  request.amountPaid = request.customerPrice;
  await request.save();

  if (request.linkedDocumentVerificationId) {
    await DB.Models.DocumentVerification.findByIdAndUpdate(
      request.linkedDocumentVerificationId,
      { $set: { amountPaid: request.customerPrice, transaction: txId } }
    );
  }
  if (request.linkedSurveyRequestId) {
    await DB.Models.SurveyRequest.findByIdAndUpdate(
      request.linkedSurveyRequestId,
      { $set: { amountPaid: request.customerPrice, transaction: txId } }
    );
  }

  return payment;
}

export async function markCatalogRequestPaid(requestId: string) {
  const request = await DB.Models.ProfessionalServiceRequest.findById(requestId);
  if (!request) return null;
  request.status = request.professionalId
    ? "in-progress"
    : "paid-awaiting-assignment";
  request.amountPaid = request.customerPrice;
  await request.save();

  if (request.linkedDocumentVerificationId) {
    await DB.Models.DocumentVerification.findByIdAndUpdate(
      request.linkedDocumentVerificationId,
      { $set: { status: "payment-approved" } }
    );
  }
  if (request.linkedSurveyRequestId) {
    await DB.Models.SurveyRequest.findByIdAndUpdate(
      request.linkedSurveyRequestId,
      { $set: { status: "payment-approved" } }
    );
  }

  if (request.professionalId) {
    const buyer = await DB.Models.Buyer.findById(request.buyerId);
    await emailProfessionalBuyerContacts({
      kind: request.category === "valuer" ? "valuer" : request.category,
      professionalUserId: request.professionalId,
      buyer: buyer || request.contact,
      referenceCode: request.reference,
      amount: request.customerPrice,
      jobId: request.linkedDocumentVerificationId
        ? String(request.linkedDocumentVerificationId)
        : request.linkedSurveyRequestId
          ? String(request.linkedSurveyRequestId)
          : String(request._id),
    });
  }

  return request;
}

export async function listMyProfessionalServiceRequests(email: string) {
  const normalized = String(email || "").toLowerCase().trim();
  if (!normalized) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Email is required.");
  }
  return DB.Models.ProfessionalServiceRequest.find({
    "contact.email": normalized,
  })
    .sort({ createdAt: -1 })
    .lean();
}

const PAID_CATALOG_STATUSES = new Set([
  "in-progress",
  "delivered",
  "completed",
]);

function categoryFromUserType(
  userType?: string
): "lawyer" | "surveyor" | "valuer" | null {
  if (userType === "Lawyer") return "lawyer";
  if (userType === "Surveyor") return "surveyor";
  if (userType === "Valuer") return "valuer";
  return null;
}

function unassignedFilter() {
  return {
    $or: [{ professionalId: null }, { professionalId: { $exists: false } }],
  };
}

function redactCatalogJob(
  request: Record<string, unknown>,
  userId: string
) {
  const paid = PAID_CATALOG_STATUSES.has(String(request.status || ""));
  const assignedToMe =
    request.professionalId &&
    String(request.professionalId) === String(userId);
  const contact = (request.contact || {}) as {
    fullName?: string;
    email?: string;
    phoneNumber?: string;
  };
  return {
    _id: request._id,
    source: "catalog",
    catalogRequestId: String(request._id),
    reference: request.reference,
    serviceName: request.serviceName,
    slug: request.slug,
    category: request.category,
    fulfillment: request.fulfillment,
    status: request.status,
    customerPrice: request.customerPrice,
    professionalFee: request.professionalFee,
    answers: request.answers || {},
    documentUrls: request.documentUrls || [],
    linkedDocumentVerificationId: request.linkedDocumentVerificationId,
    linkedSurveyRequestId: request.linkedSurveyRequestId,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    buyerId: {
      fullName: contact.fullName || "Client",
      ...(paid && assignedToMe
        ? { email: contact.email, phoneNumber: contact.phoneNumber }
        : {}),
    },
  };
}

async function createLinkedJobAfterAccept(
  request: IProfessionalServiceRequestDoc
): Promise<void> {
  const answers = (request.answers || {}) as Record<string, unknown>;

  if (
    request.fulfillment === "document-verification" &&
    !request.linkedDocumentVerificationId
  ) {
    const allowedDocTypes = [
      "certificate-of-occupancy",
      "deed-of-partition",
      "deed-of-assignment",
      "governors-consent",
      "survey-plan",
      "deed-of-lease",
      "deed-of-conveyance-or-sale",
      "land-certificate",
    ];
    const rawDocType = String(answers.documentType || "certificate-of-occupancy");
    const docType = allowedDocTypes.includes(rawDocType)
      ? rawDocType
      : "land-certificate";
    const docCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const job = await DB.Models.DocumentVerification.create({
      buyerId: request.buyerId,
      lawyerId: request.professionalId,
      docCode,
      amountPaid: request.customerPrice,
      documents: {
        documentType: docType,
        documentUrl: String(answers.documentUrl || ""),
      },
      docType,
      status: "awaiting-payment",
      source: "marketplace",
    });
    request.linkedDocumentVerificationId = job._id as Types.ObjectId;
  }

  if (
    request.fulfillment === "survey-request" &&
    !request.linkedSurveyRequestId
  ) {
    const job = await DB.Models.SurveyRequest.create({
      buyerId: request.buyerId,
      surveyorId: request.professionalId,
      serviceType: surveyorJobTypeForSlug(request.slug),
      propertyAddress: String(answers.propertyAddress || ""),
      surveyPlanUrl: String(answers.surveyPlanUrl || ""),
      notes: String(answers.notes || ""),
      amountPaid: request.customerPrice,
      status: "awaiting-payment",
      source: "marketplace",
    });
    request.linkedSurveyRequestId = job._id as Types.ObjectId;
  }
}

async function emailBuyerToPay(
  request: IProfessionalServiceRequestDoc,
  professionalName: string
): Promise<void> {
  const buyer = await DB.Models.Buyer.findById(request.buyerId);
  const email = buyer?.email || request.contact?.email;
  if (!email) return;
  const html = generalEmailLayout(
    buyerRequestAcceptedPayEmail({
      buyerName: buyer?.fullName || request.contact.fullName || "Client",
      kindLabel: request.serviceName,
      professionalName,
      amount: request.customerPrice,
      referenceCode: request.reference,
    })
  );
  void sendEmail({
    to: email,
    subject: `${professionalName} accepted – please pay to continue`,
    html,
    text: `${professionalName} accepted your ${request.serviceName} request. Pay ₦${Number(request.customerPrice).toLocaleString()} to continue.`,
    inboxMeta: request.linkedDocumentVerificationId
      ? buildBuyerDocumentMeta(String(request.linkedDocumentVerificationId))
      : {
          source: "system",
          audience: "buyer",
          screen: "professional_service",
          actionPath: "/professional-services",
          catalogRequestId: String(request._id),
        },
  });
}

export async function listCatalogJobsForProfessional(
  userId: string,
  category: "lawyer" | "surveyor" | "valuer"
) {
  const userOid = new Types.ObjectId(userId);
  const jobs = await DB.Models.ProfessionalServiceRequest.find({
    category,
    $or: [
      {
        status: "awaiting-acceptance",
        offeredTo: userOid,
        declinedBy: { $nin: [userOid] },
        ...unassignedFilter(),
      },
      { professionalId: userOid },
    ],
  })
    .sort({ createdAt: -1 })
    .lean();

  return jobs.map((job) => redactCatalogJob(job as Record<string, unknown>, userId));
}

export async function getCatalogJobForProfessional(params: {
  requestId: string;
  userId: string;
  category: "lawyer" | "surveyor" | "valuer";
}) {
  const userOid = new Types.ObjectId(params.userId);
  const request = await DB.Models.ProfessionalServiceRequest.findOne({
    _id: params.requestId,
    category: params.category,
    $or: [
      {
        status: "awaiting-acceptance",
        offeredTo: userOid,
        ...unassignedFilter(),
      },
      { professionalId: userOid },
    ],
  }).lean();
  if (!request) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Job not found.");
  }
  return redactCatalogJob(request as Record<string, unknown>, params.userId);
}

export async function acceptCatalogServiceRequest(params: {
  requestId: string;
  userId: string;
  accept: boolean;
  reason?: string;
}) {
  const user = await DB.Models.User.findById(params.userId);
  const category = categoryFromUserType(user?.userType);
  if (!user || !category) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "A lawyer, surveyor, or valuer account is required."
    );
  }

  if (!params.accept) {
    const request = await DB.Models.ProfessionalServiceRequest.findOne({
      _id: params.requestId,
      category,
      status: "awaiting-acceptance",
      offeredTo: user._id,
      ...unassignedFilter(),
    });
    if (!request) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Job not found.");
    }
    const already = (request.declinedBy || []).some(
      (id) => String(id) === String(user._id)
    );
    if (!already) {
      request.declinedBy = [...(request.declinedBy || []), user._id as Types.ObjectId];
      await request.save();
    }
    return request;
  }

  const preview = await DB.Models.ProfessionalServiceRequest.findById(
    params.requestId
  );
  if (!preview || preview.category !== category) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Job not found.");
  }
  const eligible = await isProfessionalEligibleForRequest({
    userId: String(user._id),
    category,
    serviceSlug: preview.slug,
  });
  if (!eligible) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "You are not eligible to accept this request."
    );
  }

  const locked = await DB.Models.ProfessionalServiceRequest.findOneAndUpdate(
    {
      _id: params.requestId,
      category,
      status: "awaiting-acceptance",
      $or: [{ professionalId: null }, { professionalId: { $exists: false } }],
    },
    {
      $set: {
        professionalId: user._id,
        status: "awaiting-payment",
        declineReason: undefined,
      },
    },
    { new: true }
  );

  if (!locked) {
    throw new RouteError(
      HttpStatusCodes.CONFLICT,
      "This request has already been accepted."
    );
  }

  await createLinkedJobAfterAccept(locked);
  await locked.save();

  const professionalName =
    `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
    (category === "lawyer"
      ? "Your lawyer"
      : category === "surveyor"
        ? "Your surveyor"
        : "Your valuer");

  await emailBuyerToPay(locked, professionalName);
  void notifyRequestTaken({
    request: locked,
    winnerId: String(user._id),
  });

  return locked;
}

export function categoryForAccountUser(
  userType?: string
): "lawyer" | "surveyor" | "valuer" | null {
  return categoryFromUserType(userType);
}
