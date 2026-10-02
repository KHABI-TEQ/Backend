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
import { notifyKycSubmitted } from "../../../services/kycNotification.service";

function requireDeveloper(req: AppRequest) {
  if (!req.user?._id) {
    throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
  }
  if ((req.user as { userType?: string }).userType !== "Developer") {
    throw new RouteError(HttpStatusCodes.FORBIDDEN, "This action is for Developer accounts only.");
  }
  return String(req.user._id);
}

/**
 * @swagger
 * /account/developer/verification:
 *   get:
 *     tags:
 *       - Account > Developer
 *     summary: Get developer verification details
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Developer verification fetched successfully
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
 *                     kycStatus:
 *                       type: string
 *                     kycSubmittedAt:
 *                       type: string
 *                     verificationStatus:
 *                       type: string
 *                     documents:
 *                       type: array
 *                     company:
 *                       type: object
 *                     representative:
 *                       type: object
 *                     address:
 *                       type: object
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: This action is for Developer accounts only
 */
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

/**
 * @swagger
 * /account/developer/profile:
 *   put:
 *     tags:
 *       - Account > Developer
 *     summary: Update developer profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               companyName:
 *                 type: string
 *               address:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               email:
 *                 type: string
 *               website:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Developer profile updated successfully
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
 *         description: Not authenticated
 *       403:
 *         description: This action is for Developer accounts only
 */
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

/**
 * @swagger
 * /account/developer/verification/company/lookup:
 *   post:
 *     tags:
 *       - Account > Developer
 *     summary: Lookup developer company by CAC number
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cacNumber
 *             properties:
 *               cacNumber:
 *                 type: string
 *                 description: CAC registration number
 *     responses:
 *       200:
 *         description: Company lookup successful
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
 *                     companyName:
 *                       type: string
 *                     registrationNumber:
 *                       type: string
 *                     rcNumber:
 *                       type: string
 *                     address:
 *                       type: string
 *       400:
 *         description: Enter the CAC registration number
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: This action is for Developer accounts only
 */
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

/**
 * @swagger
 * /account/developer/verification/company:
 *   put:
 *     tags:
 *       - Account > Developer
 *     summary: Save developer company verification
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               companyName:
 *                 type: string
 *               rcNumber:
 *                 type: string
 *               cacNumber:
 *                 type: string
 *               companyAddress:
 *                 type: string
 *               companyEmail:
 *                 type: string
 *               companyPhone:
 *                 type: string
 *               incorporationDate:
 *                 type: string
 *     responses:
 *       200:
 *         description: Company verification saved successfully
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
 *         description: Not authenticated
 *       403:
 *         description: This action is for Developer accounts only
 */
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

/**
 * @swagger
 * /account/developer/verification/representative:
 *   put:
 *     tags:
 *       - Account > Developer
 *     summary: Save developer representative verification
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               address:
 *                 type: string
 *               designation:
 *                 type: string
 *               idType:
 *                 type: string
 *               idNumber:
 *                 type: string
 *               idDocumentUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Representative verification saved successfully
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
 *         description: Not authenticated
 *       403:
 *         description: This action is for Developer accounts only
 */
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

/**
 * @swagger
 * /account/developer/verification/address:
 *   put:
 *     tags:
 *       - Account > Developer
 *     summary: Save developer address verification
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               address:
 *                 type: string
 *               state:
 *                 type: string
 *               localGovernment:
 *                 type: string
 *               country:
 *                 type: string
 *               proofOfAddressUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Address verification saved successfully
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
 *         description: Not authenticated
 *       403:
 *         description: This action is for Developer accounts only
 */
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

/**
 * @swagger
 * /account/developer/verification/submit:
 *   post:
 *     tags:
 *       - Account > Developer
 *     summary: Submit developer verification for admin approval
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: KYC submitted successfully
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
 *                     kycStatus:
 *                       type: string
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: This action is for Developer accounts only
 */
export const submitDeveloperVerificationController = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = requireDeveloper(req);
    const data = await submitDeveloperVerification(userId);
    const user = req.user as { firstName?: string; email?: string; userType?: string };
    try {
      await notifyKycSubmitted({
        userId,
        userType: "Developer",
        firstName: user?.firstName,
        email: user?.email,
      });
    } catch (emailErr) {
      console.warn("[submitDeveloperVerification] KYC notification failed:", emailErr);
    }
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: data.kycStatus === "approved"
        ? "Developer verification completed successfully."
        : "KYC submitted successfully. Please await admin approval within 24 hours.",
      data,
    });
  } catch (err) {
    next(err);
  }
};
