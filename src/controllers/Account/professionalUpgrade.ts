import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import {
  applyProfessionalUpgrade,
  getProfessionalUpgrade,
} from "../../services/professionalUpgrade.service";

export const applyMyProfessionalUpgrade = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
    }
    const data = await applyProfessionalUpgrade({
      userId: String(userId),
      professionalType: String(req.body?.professionalType || ""),
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Upgrade started. Complete professional verification to finish.",
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const getMyProfessionalUpgrade = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
    }
    const data = await getProfessionalUpgrade(String(userId));
    return res.status(HttpStatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
