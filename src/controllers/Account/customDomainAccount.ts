import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import {
  getOrCreateCustomDomainRequest,
  initializeCustomDomainPackagePayment,
  initializeCustomDomainRenewalPayment,
} from "../../services/customDomain.service";

export const getMyCustomDomain = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?._id) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Login required.");
    }
    const data = await getOrCreateCustomDomainRequest(String(req.user._id));
    return res.status(HttpStatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const upsertMyCustomDomainRequest = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?._id) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Login required.");
    }
    const data = await getOrCreateCustomDomainRequest(String(req.user._id), {
      preferredNames: req.body?.preferredNames,
      contactEmail: req.body?.contactEmail,
      notes: req.body?.notes,
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Custom domain request saved.",
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const submitIncludedCustomDomainRequest = async (
  _req: AppRequest,
  _res: Response,
  next: NextFunction
) => {
  next(
    new RouteError(
      HttpStatusCodes.GONE,
      "Portfolio Unlimited is no longer available, so a custom domain is not included with any listing plan."
    )
  );
};

export const payCustomDomainPackage = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?._id) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Login required.");
    }
    const result = await initializeCustomDomainPackagePayment(
      String(req.user._id),
      {
        planCode: req.body?.planCode,
        autoRenewal: req.body?.autoRenewal,
      }
    );
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Payment initialized.",
      data: {
        amount: result.amount,
        request: result.request,
        subscription: result.subscription,
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

export const renewCustomDomain = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?._id) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Login required.");
    }
    const result = await initializeCustomDomainRenewalPayment(
      String(req.user._id),
      {
        planCode: req.body?.planCode,
        autoRenewal: req.body?.autoRenewal,
      }
    );
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Renewal payment initialized.",
      data: {
        amount: result.amount,
        customDomain: result.customDomain,
        subscription: result.subscription,
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
