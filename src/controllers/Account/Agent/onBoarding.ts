import { Response, NextFunction } from 'express';
import { AppRequest } from '../../../types/express';
import { DB } from '../..';
import HttpStatusCodes from '../../../common/HttpStatusCodes';
import { generalEmailLayout } from '../../../common/emailTemplates/emailLayout';
import sendEmail from '../../../common/send.email';
import { kycSubmissionAcknowledgement } from '../../../common/emailTemplates/agentMails';
import { SystemSettingService } from '../../../services/systemSetting.service';
import { kycVerificationAdminNotification } from '../../../common/emailTemplates/adminMails';

// to be removed
export const completeOnboardingAgent = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authUser = req.user;

    if (!authUser || authUser.userType !== 'Agent') {
      return res.status(HttpStatusCodes.UNAUTHORIZED).json({
        success: false,
        message: 'Unauthorized or invalid user type',
      });
    }

    const {
      address,
      regionOfOperation,
      agentType,
      companyAgent,
      govtId,
      meansOfId,
    } = req.body;

    if (!['Individual', 'Company'].includes(agentType)) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Invalid agentType. Must be "Individual" or "Company".',
      });
    }

    const user = await DB.Models.User.findById(authUser._id);
    if (!user) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Account not found.',
      });
    }

    const agent = await DB.Models.Agent.findOne({ userId: user._id });
    if (!agent) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Agent profile not found for this account.',
      });
    }
   
    // Update the agent record with new onboarding details
    agent.address = address;
    agent.regionOfOperation = regionOfOperation;
    agent.agentType = agentType;
    agent.companyAgent = agentType === 'Company' ? companyAgent : {};
    agent.govtId = govtId;
    agent.meansOfId = meansOfId;


    if (user.referredBy) {
      await DB.Models.ReferralLog.updateOne(
        { referredUserId: user._id, rewardType: "registration_bonus" },
        { $set: { rewardStatus: "granted" } }
      );
    }

    await agent.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: 'Onboarding completed successfully. Your account is under review by the admin.',
      data: {
        agent,
      },
    });
  } catch (error) {
    next(error);
  }
};

 
export const completeAgentKYC = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authUser = req.user;

    if (!authUser || authUser.userType !== "Agent") {
      return res.status(HttpStatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "Unauthorized or invalid user type",
      });
    }

    const {
      meansOfId,
      agentLicenseNumber,
      profileBio,
      specializations,
      languagesSpoken,
      servicesOffered,
      achievements,
      address,
      regionOfOperation,
      agentType,
    } = req.body;

    // Safeguard: meansOfId must exist
    if (!meansOfId || meansOfId.length === 0) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "At least one means of ID is required.",
      });
    }

    // Find agent by userId
    const agent = await DB.Models.Agent.findOne({ userId: authUser._id });
    if (!agent) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Agent profile not found for this account.",
      });
    }

    // ✅ Update KYC fields
    agent.meansOfId = meansOfId;
    if (agentLicenseNumber) agent.kycData.agentLicenseNumber = agentLicenseNumber;
    if (profileBio) agent.kycData.profileBio = profileBio;
    if (specializations) agent.kycData.specializations = specializations;
    if (languagesSpoken) agent.kycData.languagesSpoken = languagesSpoken;
    if (servicesOffered) agent.kycData.servicesOffered = servicesOffered;
    if (achievements && achievements.length > 0) agent.kycData.achievements = achievements;
    if (address) agent.address = address;
    if (regionOfOperation) agent.regionOfOperation = regionOfOperation;
    if (agentType) agent.agentType = agentType;

    // Reset review flags
    agent.kycStatus = "pending";

    // Save updates
    await agent.save();

    // Send acknoledge mail to the agent
    const emailBody = generalEmailLayout(kycSubmissionAcknowledgement(authUser?.firstName));

    await sendEmail({
      to: authUser?.email,
      subject: "KYC Verification Request Received – Khabi-Teq Realty",
      html: emailBody,
      text: emailBody,
    });

  
    // send mail to the admin
    const companyEmailData = await SystemSettingService.getSetting("company_email");
    const reviewLink = `${process.env.ADMIN_CLIENT_LINK}/agents/${authUser?._id}`;
    const adminEmailBody = generalEmailLayout(kycVerificationAdminNotification(authUser?.firstName, authUser?.email,reviewLink));

    await sendEmail({
      to: companyEmailData?.value || process.env.ADMIN_EMAIL,
      subject: "New KYC Verification Request Pending – Khabi-Teq Realty",
      html: adminEmailBody,
      text: adminEmailBody,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "KYC documents submitted successfully. Your account is under review.",
      data: { agent },
    });
  } catch (error) {
    next(error);
  }
};
