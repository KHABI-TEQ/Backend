import { Response, NextFunction } from "express";
import { DB } from "..";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { effectiveRevealedCount } from "../../services/matchBatch.service";
import {
  createServiceBrief,
  professionalContactAfterPayment,
  selectServiceOffer,
} from "../../services/professionalCatalog.service";
import { buildPreferenceJourney } from "../../services/buyerJourney.service";

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

    const matchRows = prefIds.length
      ? await DB.Models.MatchedPreferenceProperty.find({
          preference: { $in: prefIds },
        })
          .select("preference matchedProperties revealedCount")
          .lean()
      : [];

    const revealedByPref = new Map<string, { matchedId: string; propertyIds: string[] }>();
    const revealedPropertyIds: string[] = [];
    for (const match of matchRows) {
      const allIds = match.matchedProperties || [];
      const revealed = effectiveRevealedCount(match);
      const visible = revealed > 0 ? revealed : allIds.length;
      const propertyIds = allIds
        .slice(0, visible)
        .map((id) => String(id));
      revealedByPref.set(String(match.preference), {
        matchedId: String(match._id),
        propertyIds,
      });
      revealedPropertyIds.push(...propertyIds);
    }

    const matchedProperties = revealedPropertyIds.length
      ? await DB.Models.Property.find({ _id: { $in: revealedPropertyIds } })
          .select("location propertyType")
          .lean()
      : [];
    const titleByProperty = new Map(
      matchedProperties.map((property: any) => {
        const location = property.location || {};
        const title =
          [location.area, location.localGovernment, location.state].filter(Boolean).join(", ") ||
          property.propertyType ||
          "Property";
        return [String(property._id), title];
      })
    );

    const withReviews = preferences.map((pref) => {
      const rows = reviewsByPref.get(String(pref._id)) || [];
      const match = revealedByPref.get(String(pref._id));
      return {
        ...pref,
        matchedId: match?.matchedId || null,
        matches: (match?.propertyIds || []).map((propertyId) => ({
          propertyId,
          title: titleByProperty.get(propertyId) || "Property",
        })),
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

export const getMyPreferenceJourney = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const buyerId = requireBuyerId(req);
    const journey = await buildPreferenceJourney(String(buyerId), String(req.params.id || ""));
    return res.status(HttpStatusCodes.OK).json({ success: true, data: journey });
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
      $or: [{ requestedBy: buyerId }, { bookedBy: buyerId }],
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
      data: {
        requests: requests.map((row) => {
          const selected = (row.offers || []).find(
            (offer) => String(offer.professionalId) === String(row.professionalId)
          );
          return {
            _id: row._id,
            serviceName: row.serviceName,
            status: row.status,
            reference: row.reference,
            serviceFee: row.customerPrice,
            professionalName: selected?.professionalName || "",
            offers: (row.offers || []).map((offer) => ({
              professionalId: offer.professionalId,
            })),
          };
        }),
      },
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

export const createMyServiceBrief = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const buyerId = requireBuyerId(req);
    const buyer = req.buyer as { fullName?: string; email?: string; phoneNumber?: string };
    const result = await createServiceBrief({
      category: req.body?.category,
      serviceName: String(req.body?.serviceName || "Professional service"),
      inspectionId: String(req.body?.inspectionId || ""),
      buyerId: String(buyerId),
      contact: {
        fullName: buyer.fullName || String(req.body?.fullName || ""),
        email: String(buyer.email || ""),
        phoneNumber: buyer.phoneNumber,
      },
      brief: req.body?.brief || {},
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Your brief is published. Related verified professionals have been notified.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const getMyServiceBrief = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const buyerId = requireBuyerId(req);
    const request = await DB.Models.ProfessionalServiceRequest.findOne({
      _id: req.params.id,
      buyerId,
    }).lean();
    if (!request) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Brief not found.");
    }
    const offers = (request.offers || []).map((offer) => ({
      professionalId: offer.professionalId,
      professionalName: offer.professionalName,
      coverageNote: offer.coverageNote,
      serviceFee: offer.customerPrice,
    }));
    const professional = await professionalContactAfterPayment(request);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: {
        _id: request._id,
        serviceName: request.serviceName,
        status: request.status,
        reference: request.reference,
        professionalId: request.professionalId,
        inspectionId: request.inspectionId ? String(request.inspectionId) : "",
        serviceFee: request.customerPrice,
        answers: request.answers,
        offers,
        professional,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const selectMyServiceOffer = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const buyerId = requireBuyerId(req);
    const request = await selectServiceOffer({
      requestId: req.params.id,
      buyerId: String(buyerId),
      professionalId: String(req.body?.professionalId || ""),
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Offer selected. Continue to payment.",
      data: request,
    });
  } catch (err) {
    next(err);
  }
};
