import { DB } from "../controllers";
import { isPublisherKycApproved } from "./publisherKyc.service";
import { getActivePaidAgentSubscriptionSnapshot } from "./agentSubscriptionIncentive.service";

/** Days after signup that an Agent may use listing/DealSite without approved KYC. */
export const AGENT_KYC_GRACE_PERIOD_DAYS = 7;

/** Total days from signup for the no-subscription listing/DealSite trial (includes KYC grace). */
export const AGENT_TRIAL_PERIOD_DAYS = 28;

/** Max owned properties an Agent may list without an active subscription during the trial window. */
export const AGENT_TRIAL_MAX_PROPERTIES_WITHOUT_SUBSCRIPTION = 25;

/** Max owned properties an Agent may list during the 7-day KYC grace period before KYC approval. */
export const AGENT_KYC_GRACE_MAX_PROPERTIES_WITHOUT_APPROVAL = 1;

export const AGENT_KYC_REQUIRED_MESSAGE =
  "Complete KYC verification and obtain approval to continue (the 7-day grace period has expired).";

export const AGENT_KYC_GRACE_PROPERTY_LIMIT_MESSAGE =
  "During the 7-day signup grace period you may list only 1 property until KYC is approved.";

export const AGENT_TRIAL_EXPIRED_MESSAGE =
  "Your 4-week trial period has ended. Subscribe to a plan to continue listing properties and using your public page.";

export const AGENT_TRIAL_PROPERTY_LIMIT_MESSAGE = `You have reached the trial limit of ${AGENT_TRIAL_MAX_PROPERTIES_WITHOUT_SUBSCRIPTION} properties. Subscribe to a plan to list more properties.`;

function addCalendarDays(from: Date, days: number): Date {
  const deadline = new Date(from);
  deadline.setDate(deadline.getDate() + days);
  return deadline;
}

export async function getAgentSignupAt(userId: string): Promise<Date | null> {
  const user = await DB.Models.User.findById(userId).select("createdAt userType").lean();
  if (!user || user.userType !== "Agent") {
    return null;
  }
  return user.createdAt;
}

export async function getAgentKycGraceDeadline(userId: string): Promise<Date | null> {
  const signupAt = await getAgentSignupAt(userId);
  if (!signupAt) {
    return null;
  }
  return addCalendarDays(signupAt, AGENT_KYC_GRACE_PERIOD_DAYS);
}

export async function getAgentTrialDeadline(userId: string): Promise<Date | null> {
  const signupAt = await getAgentSignupAt(userId);
  if (!signupAt) {
    return null;
  }
  return addCalendarDays(signupAt, AGENT_TRIAL_PERIOD_DAYS);
}

/** True when signup is still within the 7-day KYC grace window. */
export async function isAgentKycGraceActive(userId: string): Promise<boolean> {
  const deadline = await getAgentKycGraceDeadline(userId);
  if (!deadline) {
    return false;
  }
  return new Date() < deadline;
}

/** True when signup is still within the 4-week no-subscription trial window. */
export async function isAgentTrialPeriodActive(userId: string): Promise<boolean> {
  const deadline = await getAgentTrialDeadline(userId);
  if (!deadline) {
    return false;
  }
  return new Date() < deadline;
}

/** KYC gate passes when approved or still inside the 7-day grace period. */
export async function isAgentKycRequirementSatisfied(userId: string): Promise<boolean> {
  if (await isPublisherKycApproved(userId)) {
    return true;
  }
  return isAgentKycGraceActive(userId);
}

export async function countAgentOwnedProperties(userId: string): Promise<number> {
  return DB.Models.Property.countDocuments({
    owner: userId,
    isDeleted: { $ne: true },
  });
}

/**
 * Subscription is required when the 4-week trial ended, or the agent already owns
 * {@link AGENT_TRIAL_MAX_PROPERTIES_WITHOUT_SUBSCRIPTION} properties without a subscription.
 */
export async function isAgentSubscriptionRequired(userId: string): Promise<boolean> {
  if (!(await isAgentTrialPeriodActive(userId))) {
    return true;
  }

  const propertyCount = await countAgentOwnedProperties(userId);
  return propertyCount >= AGENT_TRIAL_MAX_PROPERTIES_WITHOUT_SUBSCRIPTION;
}

export type AgentAccessGate =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string; readonly reason: "kyc" | "subscription" };

/** Combined KYC + subscription gate for Agent listing and DealSite owner actions. */
export async function getAgentAccessGate(userId: string): Promise<AgentAccessGate> {
  if (!(await isAgentKycRequirementSatisfied(userId))) {
    return { ok: false as const, message: AGENT_KYC_REQUIRED_MESSAGE, reason: "kyc" as const };
  }

  if (await isAgentSubscriptionRequired(userId)) {
    const active = await getActivePaidAgentSubscriptionSnapshot(userId);
    if (!active) {
      const propertyCount = await countAgentOwnedProperties(userId);
      const message =
        propertyCount >= AGENT_TRIAL_MAX_PROPERTIES_WITHOUT_SUBSCRIPTION &&
        (await isAgentTrialPeriodActive(userId))
          ? AGENT_TRIAL_PROPERTY_LIMIT_MESSAGE
          : AGENT_TRIAL_EXPIRED_MESSAGE;
      return { ok: false as const, message, reason: "subscription" as const };
    }
  }

  return { ok: true as const };
}

/**
 * During days 0–7, agents without approved KYC may own at most one property.
 * Once KYC is approved, normal trial limits apply (up to 10 without subscription).
 */
export async function isAgentKycGraceListingLimitReached(userId: string): Promise<boolean> {
  if (!(await isAgentKycGraceActive(userId))) {
    return false;
  }
  if (await isPublisherKycApproved(userId)) {
    return false;
  }
  const propertyCount = await countAgentOwnedProperties(userId);
  return propertyCount >= AGENT_KYC_GRACE_MAX_PROPERTIES_WITHOUT_APPROVAL;
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
      pausedByPolicy: { $in: ["kyc", "subscription"] },
    },
    { $set: { status: "running" }, $unset: { pausedByPolicy: "" } }
  );

  return updateResult.modifiedCount;
}
