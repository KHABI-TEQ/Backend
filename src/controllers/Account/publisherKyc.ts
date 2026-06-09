import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { generalEmailLayout } from "../../common/emailTemplates/emailLayout";
import sendEmail from "../../common/send.email";
import { kycSubmissionAcknowledgement } from "../../common/emailTemplates/agentMails";
import { SystemSettingService } from "../../services/systemSetting.service";
import { notifyAllActiveAdmins } from "../../services/adminNotification.service";
import { kycVerificationAdminNotification } from "../../common/emailTemplates/adminMails";
import { isPublisherKycUserType } from "../../common/kycTypes";
import {
  normalizePublisherKycPayload,
  submitPublisherKyc,
} from "../../services/publisherKyc.service";
const KYC_USER_TYPE_LABEL: Record<string, string> = {
  Agent: "Agent",
  Developer: "Developer",
  Landowners: "Landlord",
};

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

    const profile = await submitPublisherKyc({
      userId: authUser._id,
      userType: authUser.userType,
      payload,
    });

    const roleLabel = KYC_USER_TYPE_LABEL[authUser.userType] || authUser.userType;

    const emailBody = generalEmailLayout(kycSubmissionAcknowledgement(authUser?.firstName));
    await sendEmail({
      to: authUser?.email,
      subject: "KYC Verification Request Received – Khabi-Teq",
      html: emailBody,
      text: emailBody,
    });

    const companyEmailData = await SystemSettingService.getSetting("company_email");
    const reviewLink = `${process.env.ADMIN_CLIENT_LINK}/${authUser.userType === "Agent" ? "agents" : authUser.userType === "Developer" ? "developers" : "landlords"}/${authUser?._id}`;
    const adminEmailBody = generalEmailLayout(
      kycVerificationAdminNotification(authUser?.firstName, authUser?.email, reviewLink)
    );
    await sendEmail({
      to: companyEmailData?.value || process.env.ADMIN_EMAIL,
      subject: `New ${roleLabel} KYC Verification Request – Khabi-Teq`,
      html: adminEmailBody,
      text: adminEmailBody,
    });

    void notifyAllActiveAdmins({
      type: "kyc_submitted",
      title: `New ${roleLabel} KYC verification request`,
      message: `${authUser?.firstName || roleLabel} (${authUser?.email}) submitted KYC for review.`,
      meta: {
        userId: String(authUser._id),
        userType: authUser.userType,
        reviewPath: reviewLink,
      },
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
