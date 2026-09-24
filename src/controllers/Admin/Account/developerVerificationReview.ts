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
import sendEmail from "../../../common/send.email";
import { generalEmailLayout } from "../../../common/emailTemplates/emailLayout";
import {
  accountApproved,
  accountDisapproved,
} from "../../../common/emailTemplates/agentMails";

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
    const data = profiles.map((profile) => ({
      ...profile,
      view: verificationPublicView(profile, profile.userId || {}),
    }));
    return res.status(HttpStatusCodes.OK).json({ success: true, data });
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
      const result = await adminReviewDimension(
        req.params.userId,
        dimension,
        response,
        note,
        req.admin?._id ? String(req.admin._id) : undefined
      );
      const user = result.user;
      if (user?.email && (result.becameApproved || result.rejected)) {
        const emailBody = generalEmailLayout(
          result.becameApproved
            ? accountApproved(user.firstName, "developer")
            : accountDisapproved(user.firstName, note),
        );
        try {
          await sendEmail({
            to: user.email,
            subject: result.becameApproved
              ? "Welcome to Khabi-Teq – Your Partnership Opportunity Awaits!"
              : "Update on Your Khabi-Teq KYC Application",
            text: emailBody,
            html: emailBody,
          });
        } catch (emailErr) {
          console.warn("[reviewDeveloperDimension] email failed:", emailErr);
        }
      }
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: `${dimension} ${response === "approve" ? "verified" : "marked as requiring attention"}.`,
        data: result.view,
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
