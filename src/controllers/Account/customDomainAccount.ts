import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import {
  getOrCreateCustomDomainRequest,
  initializeCustomDomainPackagePayment,
  initializeCustomDomainRenewalPayment,
} from "../../services/customDomain.service";

/**
 * @swagger
 * /account/custom-domain:
 *   get:
 *     tags:
 *       - Account > Custom Domain
 *     summary: Get custom domain request details
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Custom domain request fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     preferredNames:
 *                       type: array
 *                       items:
 *                         type: string
 *                     contactEmail:
 *                       type: string
 *                     status:
 *                       type: string
 *                     planCode:
 *                       type: string
 *       401:
 *         description: Login required
 */
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

/**
 * @swagger
 * /account/custom-domain:
 *   post:
 *     tags:
 *       - Account > Custom Domain
 *     summary: Create or update custom domain request
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               preferredNames:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Preferred domain names
 *               contactEmail:
 *                 type: string
 *                 format: email
 *                 description: Contact email for domain setup
 *               notes:
 *                 type: string
 *                 description: Additional notes
 *     responses:
 *       200:
 *         description: Custom domain request saved
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
 *       401:
 *         description: Login required
 */
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

/**
 * @swagger
 * /account/custom-domain/pay:
 *   post:
 *     tags:
 *       - Account > Custom Domain
 *     summary: Initialize custom domain package payment
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planCode
 *             properties:
 *               planCode:
 *                 type: string
 *                 description: Subscription plan code
 *               autoRenewal:
 *                 type: boolean
 *                 description: Enable auto-renewal
 *     responses:
 *       200:
 *         description: Payment initialized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     authorizationUrl:
 *                       type: string
 *                     accessCode:
 *                       type: string
 *                     reference:
 *                       type: string
 *       401:
 *         description: Login required
 */
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

/**
 * @swagger
 * /account/custom-domain/renew:
 *   post:
 *     tags:
 *       - Account > Custom Domain
 *     summary: Initialize custom domain renewal payment
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planCode
 *             properties:
 *               planCode:
 *                 type: string
 *                 description: Subscription plan code
 *               autoRenewal:
 *                 type: boolean
 *                 description: Enable auto-renewal
 *     responses:
 *       200:
 *         description: Renewal payment initialized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     authorizationUrl:
 *                       type: string
 *                     accessCode:
 *                       type: string
 *                     reference:
 *                       type: string
 *       401:
 *         description: Login required
 */
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
