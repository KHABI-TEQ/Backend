import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { matchingOutlook } from "../../../services/preferenceReview.service";

export const getPreferenceMatchingOutlook = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await matchingOutlook(req.body || {});
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Matching outlook estimated.",
      data,
    });
  } catch (err) {
    next(err);
  }
};
