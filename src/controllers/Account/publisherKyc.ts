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

/**
 * @swagger
 * /account/submitKyc:
 *   put:
 *     tags:
 *       - Account > KYC
 *     summary: Submit publisher KYC
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               kycTier:
 *                 type: string
 *               practitionerType:
 *                 type: string
 *               regionOfOperation:
 *                 type: array
 *                 items:
 *                   type: string
 *               address:
 *                 type: object
 *               documents:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: KYC submitted successfully or developer profile saved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     profile:
 *                       type: object
 *                     kycStatus:
 *                       type: string
 *       401:
 *         description: Unauthorized or invalid user type for KYC submission
 *       404:
 *         description: Agent profile not found for this account
 */
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
      message: "KYC submitted successfully. Please await admin approval within 24 hours.",
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
