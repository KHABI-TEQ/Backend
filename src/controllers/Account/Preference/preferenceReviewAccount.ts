import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import {
  getMyReview,
  upsertReview,
} from "../../../services/preferenceReview.service";

function requireAgent(req: AppRequest) {
  const userId = req.user?._id;
  if (!userId) {
    throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Login required.");
  }
  const userType = String((req.user as any)?.userType || "");
  if (userType !== "Agent") {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "Only agents can review marketplace preferences."
    );
  }
  return String(userId);
}

export const getMarketplacePreferenceReview = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const agentId = requireAgent(req);
    const { preferenceId } = req.params;
    const data = await getMyReview(agentId, preferenceId);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Preference review loaded.",
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const upsertMarketplacePreferenceReview = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const agentId = requireAgent(req);
    const { preferenceId } = req.params;
    if (!preferenceId || !mongoose.Types.ObjectId.isValid(preferenceId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid preference id.");
    }
    const data = await upsertReview(agentId, preferenceId, req.body || {});
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Review saved.",
      data,
    });
  } catch (err) {
    next(err);
  }
};
