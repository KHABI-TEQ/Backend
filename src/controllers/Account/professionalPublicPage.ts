import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import {
  getOrCreateProfessionalSiteForOwner,
  isPublicSlugGloballyAvailable,
  normalizePublicSlug,
  updateProfessionalSiteForOwner,
} from "../../services/professionalSite.service";
import type { ProfessionalSiteKind } from "../../models/professionalSite";

function requireKind(req: AppRequest, kind: ProfessionalSiteKind) {
  const expected = kind === "lawyer" ? "Lawyer" : "Surveyor";
  if (!req.user?._id || req.user.userType !== expected) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      `${expected} account required.`
    );
  }
  return req.user;
}

function serializePublicPage(result: Awaited<
  ReturnType<typeof getOrCreateProfessionalSiteForOwner>
>) {
  const { site, publicUrl, profile, user } = result;
  return {
    site: {
      id: site._id,
      kind: site.kind,
      publicSlug: site.publicSlug,
      status: site.status,
      title: site.title,
      tagline: site.tagline,
      logoUrl: site.logoUrl,
      primaryColor: site.primaryColor,
      about: site.about,
      ctaLabel: site.ctaLabel,
      createdAt: (site as any).createdAt,
      updatedAt: (site as any).updatedAt,
    },
    publicUrl,
    isMarketplaceVisible: Boolean(profile.isMarketplaceVisible),
    kycStatus: profile.kycStatus,
    fee:
      site.kind === "lawyer"
        ? Number(profile.verificationFee || 0)
        : Number(profile.surveyFee || 0),
    bankConnected: Boolean(profile.paystackSubaccountCode),
    owner: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    },
  };
}

async function getPublicPage(
  kind: ProfessionalSiteKind,
  req: AppRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = requireKind(req, kind);
    const result = await getOrCreateProfessionalSiteForOwner(
      kind,
      String(user._id)
    );
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: serializePublicPage(result),
    });
  } catch (err) {
    next(err);
  }
}

async function putPublicPage(
  kind: ProfessionalSiteKind,
  req: AppRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = requireKind(req, kind);
    const body = req.body || {};
    const result = await updateProfessionalSiteForOwner({
      kind,
      ownerId: String(user._id),
      publicSlug: body.publicSlug,
      status: body.status,
      title: body.title,
      tagline: body.tagline,
      logoUrl: body.logoUrl,
      primaryColor: body.primaryColor,
      about: body.about,
      ctaLabel: body.ctaLabel,
      isMarketplaceVisible: body.isMarketplaceVisible,
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Public page updated.",
      data: serializePublicPage(result),
    });
  } catch (err) {
    next(err);
  }
}

async function checkSlug(
  kind: ProfessionalSiteKind,
  req: AppRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = requireKind(req, kind);
    const publicSlug = normalizePublicSlug(
      req.body?.publicSlug || req.query?.publicSlug || ""
    );
    const result = await isPublicSlugGloballyAvailable(publicSlug, {
      ignoreOwnerId: String(user._id),
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      ...result,
      publicSlug,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /account/lawyer/public-page:
 *   get:
 *     tags:
 *       - Account > Professional Public Page
 *     summary: Get lawyer public page
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lawyer public page fetched successfully
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
 *                     publicSlug:
 *                       type: string
 *                     status:
 *                       type: string
 *                     title:
 *                       type: string
 *                     tagline:
 *                       type: string
 *                     logoUrl:
 *                       type: string
 *                     primaryColor:
 *                       type: string
 *                     about:
 *                       type: string
 *                     ctaLabel:
 *                       type: string
 *                     isMarketplaceVisible:
 *                       type: boolean
 *       403:
 *         description: Lawyer account required
 */
export const getLawyerPublicPage = (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => getPublicPage("lawyer", req, res, next);

/**
 * @swagger
 * /account/lawyer/public-page:
 *   put:
 *     tags:
 *       - Account > Professional Public Page
 *     summary: Update lawyer public page
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               publicSlug:
 *                 type: string
 *               status:
 *                 type: string
 *               title:
 *                 type: string
 *               tagline:
 *                 type: string
 *               logoUrl:
 *                 type: string
 *               primaryColor:
 *                 type: string
 *               about:
 *                 type: string
 *               ctaLabel:
 *                 type: string
 *               isMarketplaceVisible:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Public page updated
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
 *       403:
 *         description: Lawyer account required
 */
export const putLawyerPublicPage = (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => putPublicPage("lawyer", req, res, next);

/**
 * @swagger
 * /account/lawyer/public-page/slug-availability:
 *   post:
 *     tags:
 *       - Account > Professional Public Page
 *     summary: Check lawyer public page slug availability
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - publicSlug
 *             properties:
 *               publicSlug:
 *                 type: string
 *                 description: Slug to check availability for
 *     responses:
 *       200:
 *         description: Slug availability checked
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
 *                     available:
 *                       type: boolean
 *                     publicSlug:
 *                       type: string
 *       403:
 *         description: Lawyer account required
 */
export const checkLawyerPublicPageSlug = (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => checkSlug("lawyer", req, res, next);

/**
 * @swagger
 * /account/surveyor/public-page:
 *   get:
 *     tags:
 *       - Account > Professional Public Page
 *     summary: Get surveyor public page
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Surveyor public page fetched successfully
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
 *                     publicSlug:
 *                       type: string
 *                     status:
 *                       type: string
 *                     title:
 *                       type: string
 *                     tagline:
 *                       type: string
 *                     logoUrl:
 *                       type: string
 *                     primaryColor:
 *                       type: string
 *                     about:
 *                       type: string
 *                     ctaLabel:
 *                       type: string
 *                     isMarketplaceVisible:
 *                       type: boolean
 *       403:
 *         description: Surveyor account required
 */
export const getSurveyorPublicPage = (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => getPublicPage("surveyor", req, res, next);

/**
 * @swagger
 * /account/surveyor/public-page:
 *   put:
 *     tags:
 *       - Account > Professional Public Page
 *     summary: Update surveyor public page
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               publicSlug:
 *                 type: string
 *               status:
 *                 type: string
 *               title:
 *                 type: string
 *               tagline:
 *                 type: string
 *               logoUrl:
 *                 type: string
 *               primaryColor:
 *                 type: string
 *               about:
 *                 type: string
 *               ctaLabel:
 *                 type: string
 *               isMarketplaceVisible:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Public page updated
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
 *       403:
 *         description: Surveyor account required
 */
export const putSurveyorPublicPage = (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => putPublicPage("surveyor", req, res, next);

/**
 * @swagger
 * /account/surveyor/public-page/slug-availability:
 *   post:
 *     tags:
 *       - Account > Professional Public Page
 *     summary: Check surveyor public page slug availability
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - publicSlug
 *             properties:
 *               publicSlug:
 *                 type: string
 *                 description: Slug to check availability for
 *     responses:
 *       200:
 *         description: Slug availability checked
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
 *                     available:
 *                       type: boolean
 *                     publicSlug:
 *                       type: string
 *       403:
 *         description: Surveyor account required
 */
export const checkSurveyorPublicPageSlug = (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => checkSlug("surveyor", req, res, next);
