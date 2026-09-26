import { Response, NextFunction } from "express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { AppRequest } from "../../types/express";
import { RouteError } from "../../common/classes";
import {
  assertSurveyorFeeInRange,
  getLawyerFeeBounds,
  getSurveyorFeeBounds,
} from "../../services/professionalFee.service";
import {
  assertProfessionalPayoutReady,
  initializeDocumentVerificationPayment,
  initializeSurveyRequestPayment,
  marketplaceSearchRegex,
  notifyProfessionalOfNewRequest,
} from "../../services/professionalRequest.service";
import {
  inspectionLinkFields,
  loadBuyerFromRequest,
  resolveBuyerInspectionLink,
} from "../../utils/seekerTransactionGate";

function mapLawyerCard(p: any) {
  return {
    id: String(p.userId?._id || p.userId),
    profileId: String(p._id),
    firstName: p.userId?.firstName || "",
    lastName: p.userId?.lastName || "",
    fullName: `${p.userId?.firstName || ""} ${p.userId?.lastName || ""}`.trim(),
    profilePhoto: p.profilePhoto || p.userId?.profile_picture || "",
    bio: p.bio || "",
    firmName: p.firmName || "",
    practiceAreas: p.practiceAreas || [],
    verificationFee: p.verificationFee,
  };
}

function mapSurveyorCard(p: any) {
  return {
    id: String(p.userId?._id || p.userId),
    profileId: String(p._id),
    firstName: p.userId?.firstName || "",
    lastName: p.userId?.lastName || "",
    fullName: `${p.userId?.firstName || ""} ${p.userId?.lastName || ""}`.trim(),
    profilePhoto: p.profilePhoto || p.userId?.profile_picture || "",
    bio: p.bio || "",
    firmName: p.firmName || "",
    serviceTypes: p.serviceTypes || [],
    surveyFee: p.surveyFee,
  };
}

export const listMarketplaceLawyers = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const bounds = await getLawyerFeeBounds();
    const filter: Record<string, unknown> = {
      isMarketplaceVisible: true,
      kycStatus: "approved",
      verificationFee: { $gte: bounds.min, $lte: bounds.max },
      paystackSubaccountCode: { $exists: true, $nin: [null, ""] },
    };

    const searchRe = marketplaceSearchRegex(req.query.search as string);
    let profiles = await DB.Models.LawyerProfile.find(filter)
      .populate("userId", "firstName lastName profile_picture")
      .sort({ verificationFee: 1 })
      .lean();

    if (searchRe) {
      profiles = profiles.filter((p: any) => {
        const name = `${p.userId?.firstName || ""} ${p.userId?.lastName || ""}`;
        return (
          searchRe.test(name) ||
          searchRe.test(p.firmName || "") ||
          searchRe.test(p.bio || "")
        );
      });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: profiles.map(mapLawyerCard),
      feeBounds: bounds,
    });
  } catch (err) {
    next(err);
  }
};

export const getMarketplaceLawyer = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const profile = await DB.Models.LawyerProfile.findOne({
      userId: req.params.id,
      isMarketplaceVisible: true,
      kycStatus: "approved",
      paystackSubaccountCode: { $exists: true, $nin: [null, ""] },
    })
      .populate("userId", "firstName lastName profile_picture")
      .lean();
    if (!profile) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Lawyer not found.");
    }
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: mapLawyerCard(profile),
    });
  } catch (err) {
    next(err);
  }
};

export const listMarketplaceSurveyors = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const bounds = await getSurveyorFeeBounds();
    const filter: Record<string, unknown> = {
      isMarketplaceVisible: true,
      kycStatus: "approved",
      surveyFee: { $gte: bounds.min, $lte: bounds.max },
      paystackSubaccountCode: { $exists: true, $nin: [null, ""] },
    };

    const searchRe = marketplaceSearchRegex(req.query.search as string);
    let profiles = await DB.Models.SurveyorProfile.find(filter)
      .populate("userId", "firstName lastName profile_picture")
      .sort({ surveyFee: 1 })
      .lean();

    if (searchRe) {
      profiles = profiles.filter((p: any) => {
        const name = `${p.userId?.firstName || ""} ${p.userId?.lastName || ""}`;
        return (
          searchRe.test(name) ||
          searchRe.test(p.firmName || "") ||
          searchRe.test(p.bio || "")
        );
      });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: profiles.map(mapSurveyorCard),
      feeBounds: bounds,
    });
  } catch (err) {
    next(err);
  }
};

export const getMarketplaceSurveyor = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const profile = await DB.Models.SurveyorProfile.findOne({
      userId: req.params.id,
      isMarketplaceVisible: true,
      kycStatus: "approved",
      paystackSubaccountCode: { $exists: true, $nin: [null, ""] },
    })
      .populate("userId", "firstName lastName profile_picture")
      .lean();
    if (!profile) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Surveyor not found.");
    }
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: mapSurveyorCard(profile),
    });
  } catch (err) {
    next(err);
  }
};

export const createSurveyRequest = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      contactInfo,
      surveyorId,
      serviceType,
      propertyAddress,
      surveyPlanUrl,
      notes,
      inspectionId,
    } = req.body;

    if (!contactInfo?.email || !surveyorId || !serviceType) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing required fields.");
    }
    if (!["plan-verification", "site-survey"].includes(serviceType)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid serviceType.");
    }

    const surveyorUser = await DB.Models.User.findById(surveyorId);
    if (!surveyorUser || surveyorUser.userType !== "Surveyor") {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid surveyor.");
    }
    const profile = await DB.Models.SurveyorProfile.findOne({
      userId: surveyorId,
      isMarketplaceVisible: true,
      kycStatus: "approved",
    });
    if (!profile) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Surveyor is not available on the marketplace."
      );
    }
    assertProfessionalPayoutReady(profile);
    await assertSurveyorFeeInRange(profile.surveyFee);

    const authBuyer = await loadBuyerFromRequest(req);
    const buyer =
      authBuyer ||
      (await DB.Models.Buyer.findOneAndUpdate(
        { email: String(contactInfo.email).toLowerCase().trim() },
        {
          $set: {
            fullName: contactInfo.fullName || undefined,
            phoneNumber: contactInfo.phoneNumber || undefined,
          },
          $setOnInsert: {
            email: String(contactInfo.email).toLowerCase().trim(),
          },
        },
        { upsert: true, new: true }
      ));

    const inspectionLink = await resolveBuyerInspectionLink({
      inspectionId,
      buyerId: String(buyer._id),
    });

    const request = await DB.Models.SurveyRequest.create({
      buyerId: buyer._id,
      surveyorId,
      serviceType,
      propertyAddress,
      surveyPlanUrl,
      notes,
      amountPaid: profile.surveyFee,
      status: "awaiting-acceptance",
      ...inspectionLinkFields(inspectionLink),
    });

    const surveyorName =
      `${surveyorUser.firstName || ""} ${surveyorUser.lastName || ""}`.trim() ||
      "Surveyor";

    await notifyProfessionalOfNewRequest({
      kind: "surveyor",
      professionalUserId: String(surveyorId),
      professionalEmail: surveyorUser.email,
      professionalName: surveyorName,
      referenceCode: String(request._id).slice(-8).toUpperCase(),
      jobId: String(request._id),
      summary: `Service: ${serviceType}. Address: ${propertyAddress || "N/A"}. Fee: ₦${Number(profile.surveyFee).toLocaleString()}.`,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message:
        "Survey request submitted. The surveyor will accept or decline. You will be notified when payment is due.",
      data: {
        request,
        status: "awaiting-acceptance",
        payment: null,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const payDocumentVerification = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;
    const jobId = req.params.id;
    if (!email || !jobId) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "email and request id are required."
      );
    }
    const payment = await initializeDocumentVerificationPayment({
      jobId,
      buyerEmail: email,
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Payment initialized.",
      data: {
        payment: {
          authorization_url: payment.authorization_url,
          reference: payment.reference,
        },
        transaction: {
          authorization_url: payment.authorization_url,
          reference: payment.reference,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const paySurveyRequest = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;
    const jobId = req.params.id;
    if (!email || !jobId) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "email and request id are required."
      );
    }
    const payment = await initializeSurveyRequestPayment({
      jobId,
      buyerEmail: email,
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Payment initialized.",
      data: {
        payment: {
          authorization_url: payment.authorization_url,
          reference: payment.reference,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};
