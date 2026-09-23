import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { generalEmailLayout } from "../../../common/emailTemplates/emailLayout";
import sendEmail from "../../../common/send.email";
import {
  accountApproved,
  accountDisapproved,
} from "../../../common/emailTemplates/agentMails";
import { isPublisherKycUserType } from "../../../common/kycTypes";
import { getPublisherKycStatus } from "../../../services/publisherKyc.service";
import { resumeAgentPolicyPausedDealSites } from "../../../services/agentPublisherEligibility.service";
import { completeProfessionalUpgradeIfPending } from "../../../services/professionalUpgrade.service";

const ROLE_LABEL: Record<string, string> = {
  Agent: "Agent",
  Developer: "Developer",
  Landowners: "Landlord",
  PropertyScout: "Property Scout",
};

/**
 * Approve or reject KYC for Agent, Developer, or Landowner accounts.
 * POST /admin/users/:userId/reviewKycRequest
 */
export const reviewPublisherKyc = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;
    const { response, note } = req.body as { response: "approve" | "reject"; note?: string };

    if (!["approve", "reject"].includes(response)) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Response must be either 'approve' or 'reject'.",
      });
    }

    const approved = response === "approve";
    const userAcct = await DB.Models.User.findById(userId).exec();
    if (!userAcct) {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "User not found"));
    }

    if (!isPublisherKycUserType(userAcct.userType)) {
      return next(
        new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          "KYC review applies to Agent, Developer, Landowner, or Property Scout accounts only."
        )
      );
    }

    const currentStatus = await getPublisherKycStatus(String(userAcct._id));
    if (approved && currentStatus === "approved") {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "KYC has already been approved for this account.",
      });
    }

    if (userAcct.userType === "Agent" || userAcct.pendingProfessionalType === "Agent") {
      const agent = await DB.Models.Agent.findOne({ userId: userAcct._id }).exec();
      if (agent) {
        agent.kycStatus = approved ? "approved" : "rejected";
        if (note?.trim()) agent.kycNote = note.trim();
        await agent.save();
      } else if (userAcct.userType === "Agent") {
        return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Agent record not found"));
      }
    }

    const existingProfile = await DB.Models.PublisherProfile.findOne({
      userId: userAcct._id,
    })
      .select("advancedKyc advancedKycStatus")
      .lean();
    const hasAdvancedSubmission = Boolean(
      existingProfile?.advancedKyc?.projectName ||
        existingProfile?.advancedKycStatus === "pending" ||
        existingProfile?.advancedKycStatus === "in_review"
    );

    const profile = await DB.Models.PublisherProfile.findOneAndUpdate(
      { userId: userAcct._id },
      {
        $set: {
          kycStatus: approved ? "approved" : "rejected",
          ...(approved ? { kycApprovedAt: new Date() } : {}),
          ...(hasAdvancedSubmission
            ? { advancedKycStatus: approved ? "approved" : "rejected" }
            : {}),
          ...(note?.trim() ? { kycNote: note.trim() } : {}),
        },
        $setOnInsert: {
          userId: userAcct._id,
          userType: userAcct.userType,
        },
      },
      { upsert: true, new: true }
    );

    if (approved) {
      userAcct.accountStatus = "active";
      userAcct.isDeleted = false;
      userAcct.accountApproved = true;
      await userAcct.save();
      if (
        userAcct.pendingProfessionalType === "Agent" ||
        userAcct.pendingProfessionalType === "Developer"
      ) {
        await completeProfessionalUpgradeIfPending(
          String(userAcct._id),
          userAcct.pendingProfessionalType
        );
      }
      await userAcct.populate([]);
      const refreshed = await DB.Models.User.findById(userAcct._id);
      if (refreshed) {
        userAcct.userType = refreshed.userType;
      }

      if (userAcct.userType === "Agent") {
        await resumeAgentPolicyPausedDealSites(String(userAcct._id));
      }
    }

    const roleLabel = ROLE_LABEL[userAcct.userType] || userAcct.userType;
    const subject = approved
      ? "Welcome to Khabi-Teq – Your Partnership Opportunity Awaits!"
      : "Update on Your Khabi-Teq KYC Application";
    const emailBody = generalEmailLayout(
      approved ? accountApproved(userAcct.firstName) : accountDisapproved(userAcct.firstName, note)
    );

    await sendEmail({
      to: userAcct.email,
      subject,
      text: emailBody,
      html: emailBody,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: approved
        ? `${roleLabel} KYC approved successfully`
        : `${roleLabel} KYC rejected successfully`,
      data: { profile, kycStatus: profile?.kycStatus },
    });
  } catch (err) {
    next(err);
  }
};
