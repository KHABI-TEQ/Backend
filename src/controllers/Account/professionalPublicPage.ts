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

export const getLawyerPublicPage = (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => getPublicPage("lawyer", req, res, next);

export const putLawyerPublicPage = (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => putPublicPage("lawyer", req, res, next);

export const checkLawyerPublicPageSlug = (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => checkSlug("lawyer", req, res, next);

export const getSurveyorPublicPage = (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => getPublicPage("surveyor", req, res, next);

export const putSurveyorPublicPage = (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => putPublicPage("surveyor", req, res, next);

export const checkSurveyorPublicPageSlug = (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => checkSlug("surveyor", req, res, next);
