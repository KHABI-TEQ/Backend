import { Types } from "mongoose";
import { DB } from "../controllers";

export interface SubscriptionInfo {
  planName: string;
  planCode: string;
  startDate: Date;
  endDate: Date;
  status: string;
}

export interface AgentResponse {
  _id: Types.ObjectId;
  user: {
    _id: Types.ObjectId;
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    fullName: string;
  };
  address: {
    street: string;
    homeNo: string;
    state: string;
    localGovtArea: string;
  };
  agentType: string;
  companyAgent?: {
    companyName?: string;
    cacNumber?: string;
  };
  accountApproved: boolean;
  isInActive: boolean;
  isDeleted: boolean;
  accountStatus: string;
  isFlagged: boolean;
  kycStatus: "none" | "pending" | "in_review" | "approved" | "rejected";
  subscription?: SubscriptionInfo | null;
}

/**
 * Format agent + user + subscription into response object
 */
export const formatAgent = (
  agent: any,
  subscription?: any
): AgentResponse => {
  return {
    _id: agent._id,
    user: {
      _id: agent.userId?._id,
      email: agent.userId?.email,
      firstName: agent.userId?.firstName,
      lastName: agent.userId?.lastName,
      phoneNumber: agent.userId?.phoneNumber,
      fullName: agent.userId?.fullName,
    },
    address: agent.address,
    agentType: agent.agentType,
    companyAgent: agent.companyAgent,
    accountApproved: agent.accountApproved,
    isInActive: agent.isInActive,
    isDeleted: agent.isDeleted,
    accountStatus: agent.accountStatus,
    isFlagged: agent.isFlagged,
    kycStatus: agent.kycStatus,
    subscription: subscription
      ? {
          planName: subscription.plan?.name,
          planCode: subscription.plan?.code,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          status: subscription.status,
        }
      : null,
  };
};

/**
 * Fetch active/expired subscription for a given user
 */
export const getAgentSubscription = async (userId: Types.ObjectId) => {
  const sub = await DB.Models.UserSubscriptionSnapshot
    .findOne({
      user: userId,
      status: { $in: ["active", "expired"] },
    })
    .populate("plan", "name code")
    .select("user plan startDate endDate status")
    .lean();

  return sub || null;
};
