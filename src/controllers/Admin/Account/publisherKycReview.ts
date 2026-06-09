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
import { SystemSettingService } from "../../../services/systemSetting.service";
import { SubscriptionPlanService } from "../../../services/subscriptionPlan.service";
import { UserSubscriptionSnapshotService } from "../../../services/userSubscriptionSnapshot.service";
import { generateSubscriptionReceiptEmail } from "../../../common/emailTemplates/subscriptionMails";
import { getClientDashboardUrl } from "../../../utils/clientAppUrl";
import { isPublisherKycUserType } from "../../../common/kycTypes";
import { getPublisherKycStatus } from "../../../services/publisherKyc.service";
import { resumeAgentPolicyPausedDealSites } from "../../../services/agentPublisherEligibility.service";

const ROLE_LABEL: Record<string, string> = {
  Agent: "Agent",
  Developer: "Developer",
  Landowners: "Landlord",
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
          "KYC review applies to Agent, Developer, or Landowner accounts only."
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

    if (userAcct.userType === "Agent") {
      const agent = await DB.Models.Agent.findOne({ userId: userAcct._id }).exec();
      if (!agent) {
        return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Agent record not found"));
      }
      agent.kycStatus = approved ? "approved" : "rejected";
      if (note?.trim()) agent.kycNote = note.trim();
      await agent.save();
    }

    const profile = await DB.Models.PublisherProfile.findOneAndUpdate(
      { userId: userAcct._id },
      {
        $set: {
          kycStatus: approved ? "approved" : "rejected",
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

      if (userAcct.userType === "Agent") {
        await resumeAgentPolicyPausedDealSites(String(userAcct._id));
      }

      const grantsFreeTrial = userAcct.userType === "Agent";
      if (grantsFreeTrial) {
        const freePlanAccess = await SystemSettingService.getSetting("free_trial_status");
        if (freePlanAccess?.value) {
          const getActiveFreePlan = await SubscriptionPlanService.getActiveTrialPlan();
          if (getActiveFreePlan) {
            const price = getActiveFreePlan.price;
            const durationInDays = getActiveFreePlan.durationInDays;
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + durationInDays);

            const planFeatures =
              getActiveFreePlan.features?.map((f: any) => ({
                feature: f.feature?._id || f.feature,
                type: f.type,
                value: f.type === "boolean" || f.type === "count" ? f.value : undefined,
                remaining: f.type === "count" ? f.value : undefined,
              })) || [];

            const reference = "KT" + Math.floor(Math.random() * 9e14 + 1e14).toString();
            const transactionData = await DB.Models.NewTransaction.create({
              reference,
              fromWho: { kind: "User", item: userId },
              amount: price,
              transactionType: "subscription",
              paymentMode: "kyc approval",
              status: "success",
              currency: "NGN",
              meta: {
                planType: "Free Plan",
                planCode: getActiveFreePlan.code,
                appliedPlanName: getActiveFreePlan.name,
              },
            });

            await UserSubscriptionSnapshotService.createSnapshot({
              user: userId as string,
              plan: getActiveFreePlan._id as string,
              transaction: transactionData._id as string,
              status: "active",
              expiresAt: endDate,
              autoRenew: false,
              features: planFeatures,
              meta: {
                planType: "Free Plan",
                planCode: getActiveFreePlan.code,
                appliedPlanName: getActiveFreePlan.name,
              },
            });

            const successMailBody = generalEmailLayout(
              generateSubscriptionReceiptEmail({
                fullName: userAcct.firstName,
                planName: getActiveFreePlan.name,
                amount: price,
                nextBillingDate: endDate.toDateString(),
                transactionRef: reference,
                publicAccessSettingsLink: getClientDashboardUrl(),
              })
            );
            await sendEmail({
              to: userAcct.email,
              subject: "Welcome Gift - Free Subscription made Successfully",
              html: successMailBody,
              text: successMailBody,
            });

            await resumeAgentPolicyPausedDealSites(String(userAcct._id));
          }
        }
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
