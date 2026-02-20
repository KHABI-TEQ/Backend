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
} from "../../../validators/transactionRegistration.validator";
import {
  TRANSACTION_TYPE_CONFIGS,
  SAFE_TRANSACTION_GUIDELINES,
  getProcessingFeeNaira,
  isMandatoryRegistration,
} from "../../../config/transactionRegistration.config";
import type { TransactionRegistrationType } from "../../../models/transactionRegistration";
import type { IPropertyIdentification } from "../../../models/transactionRegistration";

const ACTIVE_OR_COMPLETED_STATUSES = ["submitted", "pending_completion", "completed"] as const;

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

/**
 * Normalize frontend register payload to internal shape (transactionType + propertyIdentification).
 */
function normalizeRegisterPayload(body: any): {
  transactionType: TransactionRegistrationType;
  propertyId: string;
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
      propertyId: body.propertyId,
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
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "For building/residential/commercial/duplex, exactAddress or lat/lng is required.");
  }
  return {
    transactionType: internalType,
    propertyId: body.propertyId,
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
      propertyId: string;
      inspectionId?: string;
      buyer: { email: string; fullName: string; phoneNumber: string };
      transactionValue: number;
      propertyIdentification: IPropertyIdentification;
    };
    let paymentReceiptFileName: string | undefined;
    let paymentReceiptBase64: string | undefined;

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
    } else {
      const validation = JoiValidator.validate(registerTransactionSchema, req.body);
      if (!validation.success) {
        const errorMessage = validation.errors.map((e) => `${e.field}: ${e.message}`).join(", ");
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, errorMessage);
      }
      const d = validation.data!;
      payload = {
        transactionType: d.transactionType as TransactionRegistrationType,
        propertyId: d.propertyId,
        inspectionId: d.inspectionId || undefined,
        buyer: d.buyer,
        transactionValue: d.transactionValue,
        propertyIdentification: d.propertyIdentification as IPropertyIdentification,
      };
    }

    const { transactionType, propertyId, inspectionId, buyer, transactionValue, propertyIdentification } = payload;

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

    const fee = getProcessingFeeNaira(transactionType, transactionValue);

    const createPayload: any = {
      transactionType,
      propertyId,
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
    if (paymentReceiptFileName != null) createPayload.paymentReceiptFileName = paymentReceiptFileName;
    if (paymentReceiptBase64 != null) createPayload.paymentReceiptBase64 = paymentReceiptBase64;
    const reg = await DB.Models.TransactionRegistration.create(createPayload);

    await DB.Models.Property.findByIdAndUpdate(propertyId, {
      status: "transaction_registered_pending",
    });

    const data: { registrationId: string; processingFee: number; paymentUrl?: string } = {
      registrationId: String(reg._id),
      processingFee: fee,
    };
    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Transaction registered successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /transaction-registration/search
 * Public due-diligence search by address, LPIN, or GPS. Returns whether a transaction is registered,
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
    const { address, lpin, lat, lng } = queryValidation.data!;
    const hasAddress = address && String(address).trim().length > 0;
    const hasLpin = lpin && String(lpin).trim().length > 0;
    const hasGps = lat != null && lng != null;
    if (!hasAddress && !hasLpin && !hasGps) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Provide at least one of: address, lpin, or both lat and lng."
      );
    }

    const conditions: any[] = [];
    if (hasAddress) {
      conditions.push({ "propertyIdentification.exactAddress": new RegExp(String(address).trim(), "i") });
    }
    if (hasLpin) {
      conditions.push({ "propertyIdentification.lpin": String(lpin).trim() });
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
      .select("transactionType status propertyId propertyIdentification createdAt")
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
      const registrationStatus =
        r.status === "completed" ? "Registered" : r.status === "submitted" || r.status === "pending_completion" ? "Pending" : String(r.status);
      return {
        address: addr,
        lpin: ident?.lpin ?? null,
        lat: gps?.lat ?? null,
        lng: gps?.lng ?? null,
        hasRegisteredTransaction: true,
        registrationStatus,
        propertyStatus: r.propertyId?.status ?? null,
        soldOrLeasedRegistered: r.status === "completed" || r.propertyId?.status === "sold_leased_registered",
        inspectionHistoryCount: propId ? inspectionCounts.get(propId) ?? 0 : 0,
        titleStatus: null,
        ownershipVerified: null,
        coordinateVerified: null,
        egisLandRecordRef: null,
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
    const { propertyId } = queryValidation.data!;

    const existing = await DB.Models.TransactionRegistration.findOne({
      propertyId,
      status: { $in: ACTIVE_OR_COMPLETED_STATUSES },
    })
      .select("status transactionType")
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
        titleStatus: null,
        ownershipVerified: null,
        coordinateVerified: null,
        egisLandRecordRef: null,
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
