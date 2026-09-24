import { DB } from "../controllers";
import { isPublisherKycApproved } from "./publisherKyc.service";
import { getActivePaidAgentSubscriptionSnapshot } from "./agentSubscriptionIncentive.service";

export const SUBSCRIPTION_REQUIRED_TO_LIST_MESSAGE =
  "Subscribe to an active plan to list properties. Listing is only available with a paid subscription.";

export const AGENT_KYC_REQUIRED_MESSAGE =
  "Complete KYC verification and obtain approval before listing properties or using your public page.";

/** @deprecated Signup grace listings are retired. Always 0. */
export const AGENT_KYC_GRACE_PERIOD_DAYS = 0;
/** @deprecated Time-boxed free trial is retired. Always 0. */
export const AGENT_TRIAL_PERIOD_DAYS = 0;
/** @deprecated Unpaid trial listing cap is retired. Always 0. */
export const AGENT_TRIAL_MAX_PROPERTIES_WITHOUT_SUBSCRIPTION = 0;
/** @deprecated Unpaid signup listing is retired. Always 0. */
export const AGENT_KYC_GRACE_MAX_PROPERTIES_WITHOUT_APPROVAL = 0;

export const AGENT_KYC_GRACE_PROPERTY_LIMIT_MESSAGE = AGENT_KYC_REQUIRED_MESSAGE;
export const AGENT_TRIAL_EXPIRED_MESSAGE = SUBSCRIPTION_REQUIRED_TO_LIST_MESSAGE;
export const AGENT_TRIAL_PROPERTY_LIMIT_MESSAGE = SUBSCRIPTION_REQUIRED_TO_LIST_MESSAGE;

export async function getAgentSignupAt(userId: string): Promise<Date | null> {
  const user = await DB.Models.User.findById(userId).select("createdAt userType").lean();
  if (!user || user.userType !== "Agent") {
    return null;
  }
  return user.createdAt;
}

/** @deprecated Grace window removed — always null. */
export async function getAgentKycGraceDeadline(_userId: string): Promise<Date | null> {
  return null;
}

/** @deprecated Trial window removed — always null. */
export async function getAgentTrialDeadline(_userId: string): Promise<Date | null> {
  return null;
}

/** @deprecated Grace window removed — always false. */
export async function isAgentKycGraceActive(_userId: string): Promise<boolean> {
  return false;
}

/** @deprecated Trial window removed — always false. */
export async function isAgentTrialPeriodActive(_userId: string): Promise<boolean> {
  return false;
}

/** Agents must have approved KYC. No signup grace period. */
export async function isAgentKycRequirementSatisfied(userId: string): Promise<boolean> {
  return isPublisherKycApproved(userId);
}

export async function countAgentOwnedProperties(userId: string): Promise<number> {
  return DB.Models.Property.countDocuments({
    owner: userId,
    isDeleted: { $ne: true },
  });
}

/** Paid subscription is always required to list. */
export async function isAgentSubscriptionRequired(_userId?: string): Promise<boolean> {
  return true;
}

export type AgentAccessGate =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string; readonly reason: "kyc" | "subscription" };

/** KYC + paid subscription gate for Agent listing and DealSite owner actions. */
export async function getAgentAccessGate(userId: string): Promise<AgentAccessGate> {
  if (!(await isAgentKycRequirementSatisfied(userId))) {
    return { ok: false as const, message: AGENT_KYC_REQUIRED_MESSAGE, reason: "kyc" as const };
  }

  const active = await getActivePaidAgentSubscriptionSnapshot(userId);
  if (!active) {
    return {
      ok: false as const,
      message: SUBSCRIPTION_REQUIRED_TO_LIST_MESSAGE,
      reason: "subscription" as const,
    };
  }

  return { ok: true as const };
}

/** @deprecated Unpaid grace listings removed — always false. */
export async function isAgentKycGraceListingLimitReached(_userId: string): Promise<boolean> {
  return false;
}

/** Auto-resume Agent DealSites that were paused by policy when the owner is eligible again. */
export async function resumeAgentPolicyPausedDealSites(userId: string): Promise<number> {
  const gate = await getAgentAccessGate(userId);
  if (gate.ok === false) {
    return 0;
  }

  const updateResult = await DB.Models.DealSite.updateMany(
    {
      createdBy: userId,
      status: "paused",
      $or: [
        { pausedByPolicy: { $in: ["kyc", "subscription", "setup"] } },
        { pausedByPolicy: { $exists: false } },
        { pausedByPolicy: null },
      ],
    },
    { $set: { status: "running" }, $unset: { pausedByPolicy: "" } }
  );

  return updateResult.modifiedCount;
}
