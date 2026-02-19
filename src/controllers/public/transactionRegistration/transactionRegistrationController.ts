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
  publicSearchSchema,
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

/**
 * GET /transaction-registration/types
 * Returns transaction types with eligibility, regulatory requirements, value bands (tiered fees), and thresholds.
 */
export const getRegistrationTypes = async (
  _req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Transaction registration types with fees and thresholds",
      data: TRANSACTION_TYPE_CONFIGS,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /transaction-registration/guidelines
 * Returns Safe Transaction Guidelines (documentation checklist, commission, ownership, title, dispute, disclosure).
 */
export const getGuidelines = async (
  _req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Safe transaction guidelines",
      data: SAFE_TRANSACTION_GUIDELINES,
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
 * POST /transaction-registration/register
 * Registers a transaction (rental, outright sale, off-plan, JV). Validates property identification (building vs land),
 * ensures no existing active/completed registration for the property, computes fee, saves registration, updates property status.
 */
export const registerTransaction = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const validation = JoiValidator.validate(registerTransactionSchema, req.body);
    if (!validation.success) {
      const errorMessage = validation.errors.map((e) => `${e.field}: ${e.message}`).join(", ");
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, errorMessage);
    }
    const {
      transactionType,
      propertyId,
      inspectionId,
      buyer,
      transactionValue,
      propertyIdentification,
    } = validation.data!;

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

    const fee = getProcessingFeeNaira(transactionType as TransactionRegistrationType, transactionValue);
    const mandatory = isMandatoryRegistration(transactionType as TransactionRegistrationType, transactionValue);

    const reg = await DB.Models.TransactionRegistration.create({
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
      propertyIdentification: propertyIdentification as IPropertyIdentification,
    });

    await DB.Models.Property.findByIdAndUpdate(propertyId, {
      status: "transaction_registered_pending",
    });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message:
        "Transaction registered successfully. Property status has been updated to 'Transaction Registered – Pending Completion'.",
      data: {
        registrationId: reg._id,
        transactionType,
        propertyId,
        processingFee: fee,
        mandatoryRegistration: mandatory,
        propertyStatus: "transaction_registered_pending",
      },
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
      return {
        registrationId: r._id,
        transactionType: r.transactionType,
        registrationStatus: r.status,
        hasRegisteredTransaction: true,
        propertyStatus: r.propertyId?.status ?? null,
        soldOrLeasedRegistered: r.status === "completed" || r.propertyId?.status === "sold_leased_registered",
        inspectionHistoryCount: propId ? inspectionCounts.get(propId) ?? 0 : 0,
        propertyIdentification: {
          exactAddress: r.propertyIdentification?.exactAddress,
          lpin: r.propertyIdentification?.lpin,
          gpsCoordinates: r.propertyIdentification?.gpsCoordinates,
        },
      };
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Due diligence search results",
      data: {
        matches: results,
        total: results.length,
      },
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
    const { propertyId } = req.query;
    if (!propertyId || typeof propertyId !== "string") {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "propertyId is required.");
    }

    const existing = await DB.Models.TransactionRegistration.findOne({
      propertyId,
      status: { $in: ACTIVE_OR_COMPLETED_STATUSES },
    })
      .select("status transactionType")
      .lean();

    const hasActiveOrCompletedRegistration = !!existing;
    const warning = hasActiveOrCompletedRegistration
      ? "This property has an active or completed registered transaction."
      : undefined;

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: {
        propertyId,
        hasActiveOrCompletedRegistration,
        warning,
        registrationStatus: existing?.status ?? null,
        transactionType: existing?.transactionType ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
};
