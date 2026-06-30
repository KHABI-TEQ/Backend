import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { DB } from "../..";
import { RouteError } from "../../../common/classes";
import { JoiValidator } from "../../../validators/JoiValidator";
import {
  buyerIntentSchema,
  registerTransactionSchema,
  registerTransactionFrontendSchema,
  publicSearchSchema,
  checkPropertyQuerySchema,
  egisValidateQuerySchema,
  certificateDownloadSchema,
} from "../../../validators/transactionRegistration.validator";
import {
  TRANSACTION_TYPE_CONFIGS,
  SAFE_TRANSACTION_GUIDELINES,
  isMandatoryRegistration,
  getProcessingFeeNaira,
} from "../../../config/transactionRegistration.config";
import type { TransactionRegistrationType } from "../../../models/transactionRegistration";
import type {
  IPropertyIdentification,
  ITransactionPractitioner,
  OffPlatformPartyType,
  TransactionRegistrationSource,
} from "../../../models/transactionRegistration";
import { PaystackService } from "../../../services/paystack.service";
import { notifyAllActiveAdmins } from "../../../services/adminNotification.service";
import sendEmail from "../../../common/send.email";
import { generalEmailLayout } from "../../../common/emailTemplates/emailLayout";
import { transactionRegistrationAcknowledgementMail } from "../../../common/emailTemplates/transactionConfirmationMails";

const ACTIVE_OR_COMPLETED_STATUSES = [
  "submitted",
  "pending_completion",
  "khabiteq_verified",
  "forwarded_to_lasrera",
  "info_requested",
  "approved",
  "certificate_issued",
  "completed",
] as const;

const REGISTERED_STATUSES = new Set(["certificate_issued", "completed"]);

function publicRegistrationStatusLabel(status: string): string {
  if (REGISTERED_STATUSES.has(status)) return "Registered";
  if (status === "submitted" || status === "pending_completion") return "Pending";
  if (status === "rejected") return "Rejected";
  if (
    status === "khabiteq_verified" ||
    status === "forwarded_to_lasrera" ||
    status === "info_requested" ||
    status === "approved"
  ) {
    return "Under review";
  }
  return status;
}

function pickTrimmedString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s.length > 0 ? s : undefined;
}

function applyOptionalRegistrationDoc(
  payload: Record<string, unknown>,
  prefix: "deedsOfAssignment" | "conveyance",
  source: Record<string, unknown>
) {
  const fileName = pickTrimmedString(source[`${prefix}FileName`]);
  const base64 = pickTrimmedString(source[`${prefix}Base64`]);
  const url = pickTrimmedString(source[`${prefix}Url`]);
  if (fileName) payload[`${prefix}FileName`] = fileName;
  if (base64) payload[`${prefix}Base64`] = base64;
  if (url) payload[`${prefix}Url`] = url;
}

async function sendRegistrationAcknowledgementEmail(options: {
  buyer: { email: string; fullName: string };
  registrationId: string;
  transactionType: TransactionRegistrationType;
  processingFeeNaira: number;
  paymentUrl?: string;
}) {
  const { buyer, registrationId, transactionType, processingFeeNaira, paymentUrl } = options;
  const typeConfig = TRANSACTION_TYPE_CONFIGS.find((c) => c.type === transactionType);
  const transactionTypeLabel = typeConfig?.label ?? transactionType;
  const htmlBody = transactionRegistrationAcknowledgementMail({
    buyerName: buyer.fullName,
    registrationId,
    transactionTypeLabel,
    processingFeeNaira,
    paymentUrl,
  });
  try {
    await sendEmail({
      to: buyer.email,
      subject: "Transaction registration received – KHABITEQ",
      text: `Hello ${buyer.fullName}, we have received your transaction registration (reference ${registrationId}).`,
      html: generalEmailLayout(htmlBody),
    });
  } catch (err) {
    console.error("[transaction-registration] Buyer acknowledgement email failed:", err);
  }
}

/** Frontend slug for each backend transaction type */
const TYPE_TO_SLUG: Record<TransactionRegistrationType, string> = {
  rental_agreement: "rental",
  outright_sale: "outright-purchase",
  off_plan_purchase: "off-plan",
  joint_venture: "joint-venture",
};

/** Map frontend slug to internal transaction type */
const SLUG_TO_TYPE: Record<string, TransactionRegistrationType> = {
  rental: "rental_agreement",
  "outright-purchase": "outright_sale",
  "contract-of-sale": "outright_sale",
  "off-plan": "off_plan_purchase",
  "joint-venture": "joint_venture",
};

/**
 * GET /transaction-registration/types
 * Returns transaction types in frontend shape: id, name, slug, label, title, mandatoryRegistrationThreshold, valueBands, eligibilityCriteria, regulatoryRequirements.
 */
export const getRegistrationTypes = async (
  _req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = TRANSACTION_TYPE_CONFIGS.map((c) => ({
      id: c.type,
      name: c.label,
      slug: TYPE_TO_SLUG[c.type],
      label: c.label,
      title: c.label,
      mandatoryRegistrationThreshold: c.mandatoryRegistrationThresholdNaira,
      valueBands: c.valueBands.map((b) => ({
        min: b.minValueNaira,
        max: b.maxValueNaira,
        feeNaira: b.processingFeeNaira,
        label: b.label,
      })),
      eligibilityCriteria: c.eligibilityCriteria,
      regulatoryRequirements: c.regulatoryRequirements,
    }));
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Transaction registration types with fees and thresholds",
      data,
    });
  } catch (error) {
    next(error);
  }
};

/** Map section heading to frontend key */
const GUIDELINES_KEYS: Record<string, string> = {
  "Required Documentation Checklist": "requiredDocumentation",
  "Commission Compliance Rules": "commissionCompliance",
  "Ownership Verification Standards": "ownershipVerification",
  "Title Verification Recommendations": "titleVerification",
  "Dispute Resolution Procedures": "disputeResolution",
  "Mandatory Data Disclosure Requirements": "mandatoryDataDisclosure",
};

/**
 * GET /transaction-registration/guidelines
 * Returns Safe Transaction Guidelines in frontend shape: requiredDocumentation, commissionCompliance, ownershipVerification, titleVerification, disputeResolution, mandatoryDataDisclosure (arrays of strings).
 */
export const getGuidelines = async (
  _req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: Record<string, string[]> = {};
    for (const section of SAFE_TRANSACTION_GUIDELINES.sections) {
      const key = GUIDELINES_KEYS[section.heading] ?? section.heading;
      data[key] = section.content;
    }
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Safe transaction guidelines",
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /transaction-registration/intent
 * Buyer confirms "I wish to proceed with this transaction" after a completed inspection.
 * Activates the Transaction Registration Guidance (next step: review guidelines and register).
 */
export const submitBuyerIntent = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const validation = JoiValidator.validate(buyerIntentSchema, req.body);
    if (!validation.success) {
      const errorMessage = validation.errors.map((e) => `${e.field}: ${e.message}`).join(", ");
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, errorMessage);
    }
    const { inspectionId, email } = validation.data!;

    const inspection = await DB.Models.InspectionBooking.findById(inspectionId)
      .populate("requestedBy")
      .lean();
    if (!inspection) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found.");
    }
    const buyer = inspection.requestedBy as any;
    if (!buyer || (buyer.email && buyer.email.toLowerCase() !== email.toLowerCase())) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "The provided email does not match the buyer for this inspection."
      );
    }
    if (inspection.status !== "completed") {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Only completed inspections can proceed to transaction registration. Please complete the inspection first."
      );
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Intent recorded. You may proceed to review the guidelines and register your transaction.",
      data: {
        inspectionId,
        nextStep: "Review the Safe Transaction Guidelines and submit your transaction registration.",
        guidelinesPath: "/transaction-registration/guidelines",
        registerPath: "/transaction-registration/register",
      },
    });
  } catch (error) {
    next(error);
  }
};

function normalizeOffPlatformPartyType(raw: unknown): OffPlatformPartyType | undefined {
  if (raw === "agent" || raw === "property_owner") return raw;
  return undefined;
}

function normalizePractitioner(raw: any): ITransactionPractitioner | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const fullName = String(raw.fullName || "").trim();
  const email = String(raw.email || "").trim();
  const phoneNumber = String(raw.phoneNumber || "").trim();
  if (!fullName && !email && !phoneNumber) return undefined;
  return {
    fullName,
    email,
    phoneNumber,
    companyName: raw.companyName ? String(raw.companyName).trim() : undefined,
    licenceNumber: raw.licenceNumber ? String(raw.licenceNumber).trim() : undefined,
    isOnPlatform: raw.isOnPlatform === true,
  };
}

function resolvePropertyId(raw?: string | null): string | undefined {
  const id = raw != null ? String(raw).trim() : "";
  if (!id) return undefined;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid propertyId format.");
  }
  return id;
}

async function assertNoDuplicateOffPlatformRegistration(
  propertyIdentification: IPropertyIdentification,
  transactionType: TransactionRegistrationType
) {
  const ors: Record<string, unknown>[] = [];
  const addr =
    propertyIdentification.type === "building"
      ? propertyIdentification.exactAddress
      : propertyIdentification.exactAddress;
  if (addr && String(addr).trim()) {
    ors.push({
      "propertyIdentification.exactAddress": new RegExp(String(addr).trim(), "i"),
    });
  }
  const gps =
    propertyIdentification.type === "land"
      ? propertyIdentification.gpsCoordinates
      : propertyIdentification.gpsCoordinates;
  if (gps?.lat != null && gps?.lng != null) {
    ors.push({
      "propertyIdentification.gpsCoordinates.lat": Number(gps.lat),
      "propertyIdentification.gpsCoordinates.lng": Number(gps.lng),
    });
  }
  if (ors.length === 0) return;

  const existing = await DB.Models.TransactionRegistration.findOne({
    $or: [{ propertyId: { $exists: false } }, { propertyId: null }],
    status: { $in: ACTIVE_OR_COMPLETED_STATUSES },
    transactionType,
    $and: [{ $or: ors }],
  }).lean();
  if (existing) {
    throw new RouteError(
      HttpStatusCodes.CONFLICT,
      "An active or completed registration already exists for this off-platform property location."
    );
  }
}

/**
 * Normalize frontend register payload to internal shape (transactionType + propertyIdentification).
 */
function normalizeRegisterPayload(body: any): {
  transactionType: TransactionRegistrationType;
  propertyId?: string;
  agentId?: string;
  practitioner?: ITransactionPractitioner;
  inspectionId?: string;
  buyer: { email: string; fullName: string; phoneNumber: string };
  transactionValue: number;
  propertyIdentification: IPropertyIdentification;
} {
  const slug = body.transactionType as string;
  const internalType = SLUG_TO_TYPE[slug];
  if (!internalType) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, `Invalid transactionType: ${slug}`);
  }
  const pi = body.propertyIdentification;
  const isLand = pi.type === "land";
  if (isLand) {
    if (pi.lat == null || pi.lng == null) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "For land transactions, lat and lng are required.");
    }
    return {
      transactionType: internalType,
      propertyId: resolvePropertyId(body.propertyId),
      agentId: body.agentId ? String(body.agentId).trim() || undefined : undefined,
      practitioner: normalizePractitioner(body.practitioner),
      inspectionId: body.inspectionId || undefined,
      buyer: body.buyer,
      transactionValue: body.transactionValue,
      propertyIdentification: {
        type: "land",
        exactAddress: pi.exactAddress || undefined,
        gpsCoordinates: { lat: Number(pi.lat), lng: Number(pi.lng) },
        surveyPlanDetails: pi.surveyPlanRef || undefined,
        ownerConfirmation: pi.ownerConfirmation != null ? String(pi.ownerConfirmation) : undefined,
      },
    };
  }
  const hasAddress = pi.exactAddress && String(pi.exactAddress).trim().length > 0;
  const hasGps = pi.lat != null && pi.lng != null;
  if (!hasAddress && !hasGps) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "For building/residential/commercial property, exactAddress or lat/lng is required.");
  }
  return {
    transactionType: internalType,
    propertyId: resolvePropertyId(body.propertyId),
    agentId: body.agentId ? String(body.agentId).trim() || undefined : undefined,
    practitioner: normalizePractitioner(body.practitioner),
    inspectionId: body.inspectionId || undefined,
    buyer: body.buyer,
    transactionValue: body.transactionValue,
    propertyIdentification: {
      type: "building",
      exactAddress: (pi.exactAddress && String(pi.exactAddress).trim()) || "Address not provided",
      lpin: undefined,
      titleReference: pi.titleNumber || undefined,
      ownerVerification: pi.ownerName || undefined,
      gpsCoordinates: hasGps ? { lat: Number(pi.lat), lng: Number(pi.lng) } : undefined,
    },
  };
}

/**
 * POST /transaction-registration/register
 * Registers a transaction. Accepts either backend shape or frontend shape (slugs, flat propertyIdentification).
 * Response: data.registrationId, data.processingFee, optional data.paymentUrl.
 */
export const registerTransaction = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let payload: {
      transactionType: TransactionRegistrationType;
      propertyId?: string;
      agentId?: string;
      practitioner?: ITransactionPractitioner;
      inspectionId?: string;
      buyer: { email: string; fullName: string; phoneNumber: string };
      transactionValue: number;
      propertyIdentification: IPropertyIdentification;
    };
    let paymentReceiptFileName: string | undefined;
    let paymentReceiptBase64: string | undefined;
    let paymentReceiptUrl: string | undefined;
    let buyerIdFileName: string | undefined;
    let buyerIdBase64: string | undefined;
    let buyerIdUrl: string | undefined;
    let optionalDocSource: Record<string, unknown> | undefined;
    let offPlatformPartyType: OffPlatformPartyType | undefined;

    const frontendValidation = JoiValidator.validate(registerTransactionFrontendSchema, req.body);
    if (frontendValidation.success && frontendValidation.data) {
      payload = normalizeRegisterPayload(frontendValidation.data);
      const fd = frontendValidation.data as any;
      if (fd.paymentReceiptFileName != null && String(fd.paymentReceiptFileName).trim()) {
        paymentReceiptFileName = String(fd.paymentReceiptFileName).trim();
      }
      if (fd.paymentReceiptBase64 != null && String(fd.paymentReceiptBase64).trim()) {
        paymentReceiptBase64 = String(fd.paymentReceiptBase64).trim();
      }
      if (fd.paymentReceiptUrl != null && String(fd.paymentReceiptUrl).trim()) {
        paymentReceiptUrl = String(fd.paymentReceiptUrl).trim();
      }
      if (fd.buyerIdFileName != null && String(fd.buyerIdFileName).trim()) {
        buyerIdFileName = String(fd.buyerIdFileName).trim();
      }
      if (fd.buyerIdBase64 != null && String(fd.buyerIdBase64).trim()) {
        buyerIdBase64 = String(fd.buyerIdBase64).trim();
      }
      if (fd.buyerIdUrl != null && String(fd.buyerIdUrl).trim()) {
        buyerIdUrl = String(fd.buyerIdUrl).trim();
      }
      optionalDocSource = fd as Record<string, unknown>;
      offPlatformPartyType = normalizeOffPlatformPartyType(fd.offPlatformPartyType);
    } else {
      const validation = JoiValidator.validate(registerTransactionSchema, req.body);
      if (!validation.success) {
        const errorMessage = validation.errors.map((e) => `${e.field}: ${e.message}`).join(", ");
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, errorMessage);
      }
      const d = validation.data!;
      payload = {
        transactionType: d.transactionType as TransactionRegistrationType,
        propertyId: resolvePropertyId(d.propertyId),
        agentId: d.agentId ? String(d.agentId).trim() || undefined : undefined,
        practitioner: normalizePractitioner(d.practitioner),
        inspectionId: d.inspectionId || undefined,
        buyer: d.buyer,
        transactionValue: d.transactionValue,
        propertyIdentification: d.propertyIdentification as IPropertyIdentification,
      };
      offPlatformPartyType = normalizeOffPlatformPartyType(d.offPlatformPartyType);
    }

    const {
      transactionType,
      propertyId,
      agentId,
      practitioner,
      inspectionId,
      buyer,
      transactionValue,
      propertyIdentification,
    } = payload;

    const registrationSource: TransactionRegistrationSource = propertyId
      ? "platform_listing"
      : "off_platform";

    if (propertyId) {
      const property = await DB.Models.Property.findById(propertyId).lean();
      if (!property) {
        throw new RouteError(HttpStatusCodes.NOT_FOUND, "Property not found.");
      }

      const existing = await DB.Models.TransactionRegistration.findOne({
        propertyId,
        status: { $in: ACTIVE_OR_COMPLETED_STATUSES },
      }).lean();
      if (existing) {
        throw new RouteError(
          HttpStatusCodes.CONFLICT,
          "This property has an active or completed registered transaction. You cannot register another transaction for it."
        );
      }
    } else {
      await assertNoDuplicateOffPlatformRegistration(propertyIdentification, transactionType);
    }

    if (agentId) {
      if (!mongoose.Types.ObjectId.isValid(agentId)) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid agentId format.");
      }
      const agent = await DB.Models.Agent.findById(agentId).lean();
      if (!agent) {
        throw new RouteError(HttpStatusCodes.NOT_FOUND, "Agent not found.");
      }
    }

    const fee = getProcessingFeeNaira(transactionType, transactionValue);

    const createPayload: Record<string, unknown> = {
      transactionType,
      registrationSource,
      inspectionId: inspectionId || undefined,
      buyer: {
        email: buyer.email,
        fullName: buyer.fullName,
        phoneNumber: buyer.phoneNumber,
      },
      transactionValue,
      processingFee: fee,
      status: "submitted",
      propertyIdentification,
    };
    if (propertyId) createPayload.propertyId = propertyId;
    if (agentId) createPayload.agentId = agentId;
    if (practitioner) createPayload.practitioner = practitioner;
    if (offPlatformPartyType && practitioner?.isOnPlatform !== true) {
      createPayload.offPlatformPartyType = offPlatformPartyType;
    }
    if (paymentReceiptFileName != null) createPayload.paymentReceiptFileName = paymentReceiptFileName;
    if (paymentReceiptBase64 != null) createPayload.paymentReceiptBase64 = paymentReceiptBase64;
    if (paymentReceiptUrl != null) createPayload.paymentReceiptUrl = paymentReceiptUrl;
    if (buyerIdFileName != null) createPayload.buyerIdFileName = buyerIdFileName;
    if (buyerIdBase64 != null) createPayload.buyerIdBase64 = buyerIdBase64;
    if (buyerIdUrl != null) createPayload.buyerIdUrl = buyerIdUrl;
    if (optionalDocSource) {
      applyOptionalRegistrationDoc(createPayload, "deedsOfAssignment", optionalDocSource);
      applyOptionalRegistrationDoc(createPayload, "conveyance", optionalDocSource);
    }
    const reg = await DB.Models.TransactionRegistration.create(createPayload);

    if (propertyId) {
      await DB.Models.Property.findByIdAndUpdate(propertyId, {
        status: "transaction_registered_pending",
      });
    }

    const propertyLabel = propertyId
      ? `property ${propertyId}`
      : propertyIdentification.type === "building"
        ? `off-platform property at ${propertyIdentification.exactAddress}`
        : "off-platform land transaction";

    void notifyAllActiveAdmins({
      type: "transaction_registration_submitted",
      title: "Transaction registration submitted",
      message: `${buyer.fullName} (${buyer.email}) registered a ${transactionType} transaction (${propertyLabel}). Processing fee: ₦${fee.toLocaleString()}.`,
      meta: {
        registrationId: String(reg._id),
        propertyId: propertyId ?? null,
        registrationSource,
        transactionType,
        buyerEmail: buyer.email,
        practitionerEmail: practitioner?.email ?? null,
        offPlatformPartyType: offPlatformPartyType ?? null,
      },
    });

    const data: { registrationId: string; processingFee: number; paymentUrl?: string } = {
      registrationId: String(reg._id),
      processingFee: fee,
    };

    if (fee > 0) {
      const buyerDoc = await DB.Models.Buyer.findOneAndUpdate(
        { email: buyer.email },
        { $setOnInsert: { fullName: buyer.fullName, phoneNumber: buyer.phoneNumber, email: buyer.email } },
        { upsert: true, new: true }
      );
      try {
        const paymentResult = await PaystackService.initializePayment({
          email: buyer.email,
          amount: fee,
          fromWho: { kind: "Buyer", item: buyerDoc._id as mongoose.Types.ObjectId },
          transactionType: "transaction-registration",
          metadata: { registrationId: String(reg._id) },
        });
        await DB.Models.TransactionRegistration.updateOne(
          { _id: reg._id },
          { $set: { paymentTransactionId: paymentResult.transactionId } }
        );
        data.paymentUrl = paymentResult.authorization_url;
      } catch (err) {
        console.error("[transaction-registration] Paystack init failed:", err);
      }
    }

    void sendRegistrationAcknowledgementEmail({
      buyer,
      registrationId: String(reg._id),
      transactionType,
      processingFeeNaira: fee,
      paymentUrl: data.paymentUrl,
    });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: data.paymentUrl
        ? "Transaction registered successfully. Complete payment to finalise."
        : "Transaction registered successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /transaction-registration/search
 * Public check property status search by address, propertyId, or GPS. Returns whether a transaction is registered,
 * sold/leased status, and limited inspection history (e.g. count or existence only).
 */
export const publicSearch = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const queryValidation = JoiValidator.validate(publicSearchSchema, req.query as any);
    if (!queryValidation.success) {
      const errorMessage = queryValidation.errors.map((e) => `${e.field}: ${e.message}`).join(", ");
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, errorMessage);
    }
    const { address, propertyId, lat, lng } = queryValidation.data!;
    const hasAddress = address && String(address).trim().length > 0;
    const hasPropertyId = propertyId && String(propertyId).trim().length > 0;
    const hasGps = lat != null && lng != null;
    if (!hasAddress && !hasPropertyId && !hasGps) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Provide at least one of: address, propertyId, or both lat and lng."
      );
    }

    const conditions: any[] = [];
    if (hasAddress) {
      conditions.push({ "propertyIdentification.exactAddress": new RegExp(String(address).trim(), "i") });
    }
    if (hasPropertyId) {
      conditions.push({ propertyId: new mongoose.Types.ObjectId(String(propertyId).trim()) });
    }
    if (hasGps) {
      conditions.push({
        "propertyIdentification.gpsCoordinates.lat": Number(lat),
        "propertyIdentification.gpsCoordinates.lng": Number(lng),
      });
    }

    const registrations = await DB.Models.TransactionRegistration.find(
      conditions.length ? { $or: conditions } : {}
    )
      .select("transactionType status propertyId propertyIdentification createdAt registrationSource practitioner")
      .populate("propertyId", "status location")
      .lean();

    const inspectionCounts = new Map<string, number>();
    if (registrations.length > 0) {
      const propertyIdStrs = [
        ...new Set(
          registrations.map((r: any) => {
            const p = r.propertyId;
            return p?._id?.toString() ?? p?.toString?.() ?? null;
          }).filter(Boolean)
        ),
      ];
      const propertyIds = propertyIdStrs.map((id) => new mongoose.Types.ObjectId(id));
      const counts = await DB.Models.InspectionBooking.aggregate([
        { $match: { propertyId: { $in: propertyIds } } },
        { $group: { _id: "$propertyId", count: { $sum: 1 } } },
      ]);
      counts.forEach((c: any) => inspectionCounts.set(c._id.toString(), c.count));
    }

    const results = registrations.map((r: any) => {
      const propId = r.propertyId?._id?.toString();
      const ident = r.propertyIdentification;
      const addr = ident?.exactAddress ?? null;
      const gps = ident?.gpsCoordinates;
      const registrationStatus = publicRegistrationStatusLabel(String(r.status));
      return {
        address: addr,
        propertyId: propId ?? null,
        lpin: ident?.lpin ?? null,
        lat: gps?.lat ?? null,
        lng: gps?.lng ?? null,
        hasRegisteredTransaction: true,
        registrationStatus,
        registrationSource: r.registrationSource ?? (propId ? "platform_listing" : "off_platform"),
        propertyStatus: r.propertyId?.status ?? null,
        soldOrLeasedRegistered:
          REGISTERED_STATUSES.has(String(r.status)) || r.propertyId?.status === "sold_leased_registered",
        inspectionHistoryCount: propId ? inspectionCounts.get(propId) ?? 0 : 0,
        titleStatus: null as string | null,
        ownershipVerified: null as boolean | null,
        coordinateVerified: null as boolean | null,
        egisLandRecordRef: null as string | null,
      };
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: null,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /transaction-registration/check
 * Check if a property has an active or completed registration (for showing warning when booking inspection or starting registration).
 * Does not block; returns a warning message when applicable.
 */
export const checkPropertyRegistration = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const queryValidation = JoiValidator.validate(checkPropertyQuerySchema, req.query as any);
    if (!queryValidation.success) {
      const errorMessage = queryValidation.errors.map((e) => `${e.field}: ${e.message}`).join(", ");
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, errorMessage || "propertyId is required.");
    }
    const { propertyId, address, lat, lng } = queryValidation.data!;
    const hasPropertyId = propertyId && String(propertyId).trim().length > 0;
    const hasAddress = address && String(address).trim().length > 0;
    const hasGps = lat != null && lng != null;

    const conditions: Record<string, unknown>[] = [];
    if (hasPropertyId) {
      conditions.push({ propertyId: new mongoose.Types.ObjectId(String(propertyId).trim()) });
    }
    if (hasAddress) {
      conditions.push({
        "propertyIdentification.exactAddress": new RegExp(String(address).trim(), "i"),
      });
    }
    if (hasGps) {
      conditions.push({
        "propertyIdentification.gpsCoordinates.lat": Number(lat),
        "propertyIdentification.gpsCoordinates.lng": Number(lng),
      });
    }

    const existing = await DB.Models.TransactionRegistration.findOne({
      status: { $in: ACTIVE_OR_COMPLETED_STATUSES },
      ...(conditions.length ? { $or: conditions } : {}),
    })
      .select("status transactionType propertyId registrationSource propertyIdentification")
      .lean();

    const hasRegistration = !!existing;
    const warning = hasRegistration
      ? "Transaction registered – Pending completion."
      : null;

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      hasRegistration,
      warning,
      data: {
        hasRegistration,
        warning: hasRegistration ? warning : null,
        registrationSource: existing?.registrationSource ?? null,
        titleStatus: null as string | null,
        ownershipVerified: null as boolean | null,
        coordinateVerified: null as boolean | null,
        egisLandRecordRef: null as string | null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /transaction-registration/egis-validate
 * Optional stub for Lagos State E-GIS title/ownership verification. Query: propertyId, address, or both lat and lng.
 * Frontend may call for "Validate with E-GIS". Returns placeholder data; can be wired to real E-GIS later.
 */
export const egisValidate = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const queryValidation = JoiValidator.validate(egisValidateQuerySchema, req.query as any);
    if (!queryValidation.success) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        data: null,
        message: "Provide at least one of: propertyId, address, or both lat and lng.",
      });
    }
    const { propertyId, address, lat, lng } = queryValidation.data!;
    const hasProp = propertyId && String(propertyId).trim().length > 0;
    const hasAddr = address && String(address).trim().length > 0;
    const hasGps = lat != null && lng != null;
    if (!hasProp && !hasAddr && !hasGps) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        data: null,
        message: "Provide at least one of: propertyId, address, or both lat and lng.",
      });
    }
    const data = {
      titleStatus: null as string | null,
      ownershipVerified: null as boolean | null,
      coordinateVerified: null as boolean | null,
      egisLandRecordRef: null as string | null,
    };
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data,
      message: null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Shared buyer certificate access check (email + registration reference must match).
 */
async function resolveBuyerCertificateAccess(email: string, registrationId: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const id = registrationId.trim();

  if (!normalizedEmail || !id || !mongoose.Types.ObjectId.isValid(id)) {
    return {
      ok: false as const,
      status: HttpStatusCodes.BAD_REQUEST,
      message: "Provide a valid registration reference and buyer email.",
    };
  }

  const registration = await DB.Models.TransactionRegistration.findById(id)
    .select("buyer status certificateUrl certificateNumber certificateIssuedAt")
    .lean();

  if (!registration || registration.buyer?.email?.toLowerCase() !== normalizedEmail) {
    return {
      ok: false as const,
      status: HttpStatusCodes.NOT_FOUND,
      message:
        "No certificate found for the registration reference and email provided. Check your details and try again.",
    };
  }

  if (!REGISTERED_STATUSES.has(String(registration.status)) || !registration.certificateUrl) {
    return {
      ok: false as const,
      status: HttpStatusCodes.BAD_REQUEST,
      message:
        "Your certificate is not yet available. Your registration may still be under review by KHABITEQ or LASRERA.",
    };
  }

  return {
    ok: true as const,
    data: {
      certificateUrl: registration.certificateUrl,
      certificateNumber: registration.certificateNumber,
      issuedAt: registration.certificateIssuedAt,
      buyerName: registration.buyer?.fullName,
      registrationId: id,
    },
  };
}

/**
 * POST /transaction-registration/certificate/download
 * Secure buyer certificate download — requires registration reference and matching buyer email.
 */
export const requestRegistrationCertificateDownload = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const validation = JoiValidator.validate(certificateDownloadSchema, req.body);
    if (!validation.success) {
      const errorMessage = validation.errors.map((e) => e.message).join(" ");
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: errorMessage || "Invalid request.",
        data: null,
      });
    }

    const { email, registrationId } = validation.data!;
    const result = await resolveBuyerCertificateAccess(email, registrationId);

    if (!result.ok) {
      return res.status(result.status).json({
        success: false,
        message: result.message,
        data: null,
      });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Certificate verified. You may download your certificate.",
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /transaction-registration/:registrationId/certificate
 * @deprecated Prefer POST /certificate/download — retained for backward compatibility.
 */
export const downloadRegistrationCertificate = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { registrationId } = req.params;
    const email = String(req.query.email || "");

    const result = await resolveBuyerCertificateAccess(email, registrationId);

    if (!result.ok) {
      return res.status(result.status).json({
        success: false,
        message: result.message,
        data: null,
      });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Certificate available",
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};
