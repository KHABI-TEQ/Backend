import { Response, NextFunction } from "express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { AppRequest } from "../../types/express";
import { RouteError } from "../../common/classes";
import {
  createProfessionalServiceRequest,
  getProfessionalServiceBySlug,
  initializeCatalogRequestPayment,
  listMyProfessionalServiceRequests,
  listProfessionalServiceCatalog,
} from "../../services/professionalCatalog.service";

export const listProfessionalServices = async (
  _req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: listProfessionalServiceCatalog(),
    });
  } catch (err) {
    next(err);
  }
};

export const getProfessionalService = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: getProfessionalServiceBySlug(req.params.slug),
    });
  } catch (err) {
    next(err);
  }
};

export const createCatalogServiceRequest = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { contact, answers } = req.body || {};
    if (!contact?.email || !contact?.fullName) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Contact name and email are required."
      );
    }
    const result = await createProfessionalServiceRequest({
      slug: req.params.slug,
      contact,
      answers,
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: result.nextStep,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const payCatalogServiceRequest = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Email is required.");
    }
    const payment = await initializeCatalogRequestPayment({
      requestId: req.params.id,
      email,
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

export const listMyCatalogServiceRequests = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const email = String(req.query.email || "");
    const requests = await listMyProfessionalServiceRequests(email);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: requests,
    });
  } catch (err) {
    next(err);
  }
};
