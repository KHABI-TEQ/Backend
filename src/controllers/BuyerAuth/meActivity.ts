import { Response, NextFunction } from "express";
import { DB } from "..";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";

function requireBuyerId(req: AppRequest) {
  const id = req.buyer?._id;
  if (!id) {
    throw new RouteError(
      HttpStatusCodes.UNAUTHORIZED,
      "Buyer not authenticated."
    );
  }
  return id;
}

export const getMyPreferences = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const buyerId = requireBuyerId(req);
    const preferences = await DB.Models.Preference.find({ buyer: buyerId })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: { preferences },
    });
  } catch (err) {
    next(err);
  }
};

export const getMyInspections = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const buyerId = requireBuyerId(req);
    const inspections = await DB.Models.InspectionBooking.find({
      requestedBy: buyerId,
    })
      .sort({ createdAt: -1 })
      .populate(
        "propertyId",
        "title propertyName location price images propertyType"
      )
      .lean();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: { inspections },
    });
  } catch (err) {
    next(err);
  }
};

export const getMyDocumentVerifications = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const buyerId = requireBuyerId(req);
    const documents = await DB.Models.DocumentVerification.find({
      buyerId,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: { documents },
    });
  } catch (err) {
    next(err);
  }
};

export const getMyTransactionRegistrations = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const buyer = req.buyer;
    if (!buyer?._id) {
      throw new RouteError(
        HttpStatusCodes.UNAUTHORIZED,
        "Buyer not authenticated."
      );
    }

    const email = String(buyer.email || "")
      .toLowerCase()
      .trim();

    const transactions = await DB.Models.TransactionRegistration.find({
      "buyer.email": email,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: { transactions },
    });
  } catch (err) {
    next(err);
  }
};

/** Aggregated status hub for the mobile home / track screen. */
export const getMyActivitySummary = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const buyer = req.buyer;
    if (!buyer?._id) {
      throw new RouteError(
        HttpStatusCodes.UNAUTHORIZED,
        "Buyer not authenticated."
      );
    }

    const buyerId = buyer._id;
    const email = String(buyer.email || "")
      .toLowerCase()
      .trim();

    const [preferences, inspections, documents, transactions] =
      await Promise.all([
        DB.Models.Preference.find({ buyer: buyerId })
          .select(
            "preferenceType preferenceMode status location contactInfo createdAt updatedAt"
          )
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
        DB.Models.InspectionBooking.find({ requestedBy: buyerId })
          .select(
            "status inspectionMode stage inspectionDate inspectionTime createdAt updatedAt propertyId"
          )
          .sort({ createdAt: -1 })
          .limit(20)
          .populate("propertyId", "title propertyName location")
          .lean(),
        DB.Models.DocumentVerification.find({ buyerId })
          .select("docCode docType status amountPaid createdAt updatedAt")
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
        DB.Models.TransactionRegistration.find({ "buyer.email": email })
          .select(
            "status transactionType transactionValue propertyIdentification createdAt updatedAt"
          )
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
      ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: {
        counts: {
          preferences: preferences.length,
          inspections: inspections.length,
          documents: documents.length,
          transactions: transactions.length,
        },
        preferences,
        inspections,
        documents,
        transactions,
      },
    });
  } catch (err) {
    next(err);
  }
};
