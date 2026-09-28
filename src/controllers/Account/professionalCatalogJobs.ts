import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import {
  acceptCatalogServiceRequest,
  categoryForAccountUser,
  getCatalogJobForProfessional,
  listCatalogJobsForProfessional,
  submitServiceOffer,
} from "../../services/professionalCatalog.service";

function requireProfessional(req: AppRequest) {
  if (!req.user?._id) {
    throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Account required.");
  }
  const pending = (req.user as { pendingProfessionalType?: string })
    ?.pendingProfessionalType;
  const userType = req.user.userType;
  const effective =
    userType === "PropertyScout" && pending ? pending : userType;
  const category = categoryForAccountUser(effective);
  if (!category) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "A lawyer, surveyor, or valuer account is required."
    );
  }
  return { user: req.user, category };
}

export const listProfessionalServiceJobs = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { user, category } = requireProfessional(req);
    const jobs = await listCatalogJobsForProfessional(
      String(user._id),
      category
    );
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: jobs,
    });
  } catch (err) {
    next(err);
  }
};

export const getProfessionalServiceJob = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { user, category } = requireProfessional(req);
    const job = await getCatalogJobForProfessional({
      requestId: req.params.id,
      userId: String(user._id),
      category,
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: job,
    });
  } catch (err) {
    next(err);
  }
};

export const respondProfessionalServiceJob = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { user } = requireProfessional(req);
    if (req.body?.coverageNote || req.body?.fee) {
      const job = await submitServiceOffer({
        requestId: req.params.id,
        userId: String(user._id),
        coverageNote: String(req.body.coverageNote || ""),
        fee: Number(req.body.fee),
        commissionAccepted: req.body.commissionAccepted === true,
        letterheadReportAccepted: req.body.letterheadReportAccepted === true,
      });
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: "Offer sent. The client can compare it with other professionals.",
        data: job,
      });
    }
    const accept = req.body?.accept === true;
    const reason = req.body?.reason as string | undefined;
    const job = await acceptCatalogServiceRequest({
      requestId: req.params.id,
      userId: String(user._id),
      accept,
      reason,
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: accept
        ? "Request accepted. The client has been asked to pay."
        : "You declined this request. It remains open for other professionals.",
      data: job,
    });
  } catch (err) {
    next(err);
  }
};
