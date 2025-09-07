import { Response, NextFunction } from 'express';
import { AppRequest } from '../../../types/express';
import { DB } from '../..';
import HttpStatusCodes from '../../../common/HttpStatusCodes';

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

    agent.isInActive = false;
    agent.isDeleted = false;
    agent.accountApproved = false;
    agent.isFlagged = false;
    agent.accountStatus = 'active';

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

    // Destructure all possible fields from request body
    const {
      govtId,
      meansOfId,
      agentLicenseNumber,
      profileBio,
      specializations,
      languagesSpoken,
      servicesOffered,
      achievements,
      featuredListings,
      address,
      regionOfOperation,
      agentType,
    } = req.body;

    // Additional safeguard (should already be validated by Joi)
    if (!govtId || !meansOfId || meansOfId.length === 0) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Missing required KYC documents (govtId or meansOfId)",
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

    // Update KYC fields
    agent.govtId = govtId;
    agent.meansOfId = meansOfId;

    // if (agentLicenseNumber) agent.agentLicenseNumber = agentLicenseNumber;
    // if (profileBio) agent.profileBio = profileBio;
    // if (specializations) agent.specializations = specializations;
    // if (languagesSpoken) agent.languagesSpoken = languagesSpoken;
    // if (servicesOffered) agent.servicesOffered = servicesOffered;
    // if (achievements) agent.achievements = achievements;
    // if (featuredListings) agent.featuredListings = featuredListings;

    // Update core agent info
    if (address) agent.address = address;
    if (regionOfOperation) agent.regionOfOperation = regionOfOperation;
    if (agentType) agent.agentType = agentType;

    // Set account review flags
    agent.accountApproved = false;
    agent.isFlagged = false;

    // Save agent
    await agent.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "KYC documents submitted successfully. Your account is under review.",
      data: { agent },
    });
  } catch (error) {
    next(error);
  }
};


export const setAgentInspectionFee = async (
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

    const { inspectionPrice, inspectionPriceEnabled } = req.body;

    if (inspectionPrice !== undefined && (typeof inspectionPrice !== "number" || inspectionPrice < 0)) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Inspection price must be a non-negative number.",
      });
    }

    if (inspectionPriceEnabled !== undefined && typeof inspectionPriceEnabled !== "boolean") {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "inspectionPriceEnabled must be a boolean value.",
      });
    }

    const agent = await DB.Models.Agent.findOne({ userId: authUser._id });
    if (!agent) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Agent profile not found for this account.",
      });
    }

    // Update inspection settings
    // agent.inspectionSettings = agent.inspectionSettings || { inspectionPrice: 0, inspectionPriceEnabled: false };

    // if (inspectionPrice !== undefined) agent.inspectionSettings.inspectionPrice = inspectionPrice;
    // if (inspectionPriceEnabled !== undefined) agent.inspectionSettings.inspectionPriceEnabled = inspectionPriceEnabled;

    await agent.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Inspection settings updated successfully.",
      data: { inspectionSettings: null },
    });
  } catch (error) {
    next(error);
  }
};