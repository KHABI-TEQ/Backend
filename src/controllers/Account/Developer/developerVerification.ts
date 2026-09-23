import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import {
  ensureDeveloperProfile,
  lookupCompany,
  saveAddressVerification,
  saveCompanyVerification,
  saveDeveloperProfile,
  saveRepresentativeVerification,
  submitDeveloperVerification,
  verificationPublicView,
} from "../../../services/developerVerification.service";

function requireDeveloper(req: AppRequest) {
  if (!req.user?._id) {
    throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
  }
  if ((req.user as { userType?: string }).userType !== "Developer") {
    throw new RouteError(HttpStatusCodes.FORBIDDEN, "This action is for Developer accounts only.");
  }
  return String(req.user._id);
}

export const getDeveloperVerification = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = requireDeveloper(req);
    const { user, profile } = await ensureDeveloperProfile(userId);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: verificationPublicView(profile, user),
    });
  } catch (err) {
    next(err);
  }
};

export const putDeveloperProfile = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = requireDeveloper(req);
    const data = await saveDeveloperProfile(userId, req.body);
    return res.status(HttpStatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const lookupDeveloperCompany = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = requireDeveloper(req);
    const cacNumber = String(req.body?.cacNumber || "");
    if (!cacNumber.trim()) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Enter the CAC registration number issued by the Corporate Affairs Commission.");
    }
    const data = await lookupCompany(userId, cacNumber);
    return res.status(HttpStatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const putDeveloperCompany = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = requireDeveloper(req);
    const data = await saveCompanyVerification(userId, req.body);
    return res.status(HttpStatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const putDeveloperRepresentative = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = requireDeveloper(req);
    const { view, lookup } = await saveRepresentativeVerification(userId, {
      ...req.body,
      runVerify: true,
    });
    return res.status(HttpStatusCodes.OK).json({ success: true, data: { ...view, lookup } });
  } catch (err) {
    next(err);
  }
};

export const putDeveloperAddress = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = requireDeveloper(req);
    const data = await saveAddressVerification(userId, req.body);
    return res.status(HttpStatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const submitDeveloperVerificationController = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = requireDeveloper(req);
    const data = await submitDeveloperVerification(userId);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Verification submitted for review where automatic checks could not complete.",
      data,
    });
  } catch (err) {
    next(err);
  }
};
