import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import {
  acceptCatalogServiceRequest,
  categoryForAccountUser,
  getCatalogJobForProfessional,
  listCatalogJobsForProfessional,
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
