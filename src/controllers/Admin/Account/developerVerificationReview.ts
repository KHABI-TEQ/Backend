import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import {
  adminReviewDimension,
  ensureDeveloperProfile,
  verificationPublicView,
} from "../../../services/developerVerification.service";
import {
  adminReviewProject,
  getAdminProject,
  listPendingProjects,
  publishApprovedProject,
} from "../../../services/offPlanProject.service";
import { DB } from "../..";

export const listPendingDeveloperVerification = async (
  _req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const profiles = await DB.Models.PublisherProfile.find({
      userType: "Developer",
      $or: [
        { "verification.company.status": { $in: ["pending", "requires_attention"] } },
        { "verification.representative.status": { $in: ["pending", "requires_attention"] } },
        { "verification.address.status": { $in: ["pending", "requires_attention"] } },
        { kycStatus: { $in: ["pending", "in_review"] } },
        { advancedKycStatus: { $in: ["pending", "in_review"] } },
      ],
    })
      .populate("userId", "firstName lastName email phoneNumber accountId")
      .sort({ updatedAt: -1 })
      .lean();
    return res.status(HttpStatusCodes.OK).json({ success: true, data: profiles });
  } catch (err) {
    next(err);
  }
};

export const getDeveloperVerificationAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { user, profile } = await ensureDeveloperProfile(req.params.userId);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: {
        user,
        profile,
        view: verificationPublicView(profile, user),
      },
    });
  } catch (err) {
    next(err);
  }
};

function reviewHandler(dimension: "company" | "representative" | "address") {
  return async (req: AppRequest, res: Response, next: NextFunction) => {
    try {
      const { response, note } = req.body as { response: "approve" | "reject"; note?: string };
      if (!["approve", "reject"].includes(response)) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Response must be approve or reject.");
      }
      const data = await adminReviewDimension(
        req.params.userId,
        dimension,
        response,
        note,
        req.admin?._id ? String(req.admin._id) : undefined
      );
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: `${dimension} ${response === "approve" ? "verified" : "marked as requiring attention"}.`,
        data,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const reviewDeveloperCompany = reviewHandler("company");
export const reviewDeveloperRepresentative = reviewHandler("representative");
export const reviewDeveloperAddress = reviewHandler("address");

export const listAdminOffPlanProjects = async (
  _req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await listPendingProjects();
    return res.status(HttpStatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getAdminOffPlanProject = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await getAdminProject(req.params.id);
    return res.status(HttpStatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const reviewAdminOffPlanProject = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { response, note, publish } = req.body as {
      response: "approve" | "reject";
      note?: string;
      publish?: boolean;
    };
    if (!["approve", "reject"].includes(response)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Response must be approve or reject.");
    }
    let data = await adminReviewProject(
      req.params.id,
      response,
      note,
      req.admin?._id ? String(req.admin._id) : undefined
    );
    if (response === "approve" && publish !== false) {
      data = await publishApprovedProject(req.params.id);
    }
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: response === "approve" ? "Project approved." : "Project rejected.",
      data,
    });
  } catch (err) {
    next(err);
  }
};
