import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import {
  buildPublicProfessionalCard,
  getRunningProfessionalSiteBySlug,
  submitPublicPageDocumentVerification,
  submitPublicPageSurveyRequest,
} from "../../services/professionalSite.service";

export const getProfessionalSiteBySlug = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const publicSlug = String(req.params.publicSlug || "").trim();
    if (!publicSlug) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Public slug is required.");
    }

    try {
      const site = await getRunningProfessionalSiteBySlug(publicSlug);
      const card = await buildPublicProfessionalCard(site);
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        data: card,
      });
    } catch (err: any) {
      if (err instanceof RouteError && err.status === HttpStatusCodes.NOT_FOUND) {
        return res.status(HttpStatusCodes.NOT_FOUND).json({
          success: false,
          errorCode: "PROFESSIONAL_SITE_NOT_FOUND",
          message: "Professional page not found.",
          data: null,
        });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
};

export const submitProfessionalSiteDocumentVerification = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const publicSlug = String(req.params.publicSlug || "").trim();
    const { contactInfo, documentsMetadata } = req.body || {};
    const result = await submitPublicPageDocumentVerification({
      publicSlug,
      contactInfo,
      documentsMetadata,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Pay now to complete your document verification request.",
      data: {
        docCode: result.docCode,
        amount: result.amount,
        status: "pending",
        source: "public-page",
        documentIds: result.docs.map((d) => String(d._id)),
        payment: {
          authorization_url: result.payment.authorization_url,
          access_code: result.payment.access_code,
          reference: result.payment.reference,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const submitProfessionalSiteSurveyRequest = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const publicSlug = String(req.params.publicSlug || "").trim();
    const {
      contactInfo,
      serviceType,
      propertyAddress,
      surveyPlanUrl,
      notes,
    } = req.body || {};

    const result = await submitPublicPageSurveyRequest({
      publicSlug,
      contactInfo,
      serviceType,
      propertyAddress,
      surveyPlanUrl,
      notes,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Pay now to complete your survey request.",
      data: {
        requestId: String(result.request._id),
        requestCode: result.requestCode,
        amount: result.amount,
        status: "pending",
        source: "public-page",
        payment: {
          authorization_url: result.payment.authorization_url,
          access_code: result.payment.access_code,
          reference: result.payment.reference,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};
