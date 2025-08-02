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
    agent.isInUpgrade = false;
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
