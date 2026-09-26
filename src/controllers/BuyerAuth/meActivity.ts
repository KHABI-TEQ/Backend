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

    const prefIds = preferences.map((p) => p._id);
    const reviews = prefIds.length
      ? await DB.Models.PreferenceReview.find({ preferenceId: { $in: prefIds } })
          .select("preferenceId budgetFit suggestedBudget updatedAt")
          .sort({ updatedAt: -1 })
          .lean()
      : [];

    const reviewsByPref = new Map<string, typeof reviews>();
    for (const row of reviews) {
      const key = String(row.preferenceId);
      const list = reviewsByPref.get(key) || [];
      list.push(row);
      reviewsByPref.set(key, list);
    }

    const withReviews = preferences.map((pref) => {
      const rows = reviewsByPref.get(String(pref._id)) || [];
      return {
        ...pref,
        marketReviews: rows.map((row) => ({
          budgetFit: row.budgetFit === "too_low" ? "too_low" : "moderate",
          suggestedBudget: row.suggestedBudget?.min
            ? {
                min: row.suggestedBudget.min,
                max: row.suggestedBudget.max,
                currency: row.suggestedBudget.currency || "NGN",
              }
            : null,
          reviewedAt: row.updatedAt,
        })),
      };
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: { preferences: withReviews, buyerId: String(buyerId) },
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

export const getMySurveyRequests = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const buyerId = requireBuyerId(req);
    const surveys = await DB.Models.SurveyRequest.find({ buyerId })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: { surveys },
    });
  } catch (err) {
    next(err);
  }
};

export const getMyProfessionalServiceRequests = async (
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

    const requests = await DB.Models.ProfessionalServiceRequest.find({
      $or: [{ buyerId: buyer._id }, { "contact.email": email }],
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: { requests },
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

    const [preferences, inspections, documents, surveys, transactions, policies, claims, professionalServices] =
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
        DB.Models.SurveyRequest.find({ buyerId })
          .select(
            "serviceType status amountPaid propertyAddress createdAt updatedAt"
          )
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
        DB.Models.TransactionRegistration.find({ "buyer.email": email })
          .select(
            "status transactionType transactionValue propertyIdentification createdAt updatedAt transactionReference propertyCode certificateStatus certificateUrl"
          )
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
        DB.Models.SearchInsurancePolicy.find({ buyer: buyerId })
          .select("status premiumAmount coverAmount policyReference paidAt createdAt preference")
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
        DB.Models.SearchInsuranceClaim.find({ buyer: buyerId })
          .select("status description approvedAmount createdAt policy preference")
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
        DB.Models.ProfessionalServiceRequest.find({
          $or: [{ buyerId }, { "contact.email": email }],
        })
          .select(
            "reference slug serviceName category status customerPrice createdAt updatedAt"
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
          surveys: surveys.length,
          transactions: transactions.length,
          searchInsurancePolicies: policies.length,
          searchInsuranceClaims: claims.length,
          professionalServices: professionalServices.length,
        },
        preferences,
        inspections,
        documents,
        surveys,
        transactions,
        searchInsurancePolicies: policies,
        searchInsuranceClaims: claims,
        professionalServices,
      },
    });
  } catch (err) {
    next(err);
  }
};
