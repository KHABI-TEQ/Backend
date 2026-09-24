import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { isPublisherKycUserType } from "../../common/kycTypes";
import { notifyKycSubmitted } from "../../services/kycNotification.service";
import {
  normalizePublisherKycPayload,
  submitPublisherKyc,
} from "../../services/publisherKyc.service";

export const completePublisherKYC = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authUser = req.user;

    if (!authUser || !isPublisherKycUserType(authUser.userType)) {
      return res.status(HttpStatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "Unauthorized or invalid user type for KYC submission.",
      });
    }

    const payload = normalizePublisherKycPayload(req.body || {});

    if (authUser.userType === "Agent") {
      const agent = await DB.Models.Agent.findOne({ userId: authUser._id });
      if (!agent) {
        return res.status(HttpStatusCodes.NOT_FOUND).json({
          success: false,
          message: "Agent profile not found for this account.",
        });
      }
    }

    if (authUser.userType === "PropertyScout") {
      if (!payload.practitionerType) payload.practitionerType = "Individual";
      if (!payload.regionOfOperation?.length) {
        const state = payload.address?.state;
        payload.regionOfOperation = state ? [state] : ["Lagos"];
      }
    }

    const profile = await submitPublisherKyc({
      userId: authUser._id,
      userType: authUser.userType,
      payload,
    });

    if (payload.kycTier === "basic") {
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: "Developer profile saved. You can list completed properties now.",
        data: { profile, kycStatus: profile.kycStatus },
      });
    }

    await notifyKycSubmitted({
      userId: String(authUser._id),
      userType: authUser.userType,
      firstName: authUser?.firstName,
      email: authUser?.email,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "KYC documents submitted successfully. Your account is under review.",
      data: { profile, kycStatus: profile.kycStatus },
    });
  } catch (error) {
    if ((error as Error).message === "INVALID_USER_TYPE") {
      return next(new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid user type for KYC."));
    }
    next(error);
  }
};

/** @deprecated Use completePublisherKYC — kept as alias for Agent-only callers. */
export const completeAgentKYC = completePublisherKYC;
