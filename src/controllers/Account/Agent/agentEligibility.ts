import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import {
  AGENT_KYC_GRACE_MAX_PROPERTIES_WITHOUT_APPROVAL,
  AGENT_KYC_GRACE_PERIOD_DAYS,
  AGENT_TRIAL_MAX_PROPERTIES_WITHOUT_SUBSCRIPTION,
  AGENT_TRIAL_PERIOD_DAYS,
  countAgentOwnedProperties,
  getAgentAccessGate,
  getAgentKycGraceDeadline,
  getAgentTrialDeadline,
  isAgentKycGraceActive,
  isAgentKycRequirementSatisfied,
  isAgentSubscriptionRequired,
  isAgentTrialPeriodActive,
} from "../../../services/agentPublisherEligibility.service";
import { getPublisherKycStatus } from "../../../services/publisherKyc.service";
import {
  AGENT_SUBSCRIPTION_BONUS_DAYS,
  getActivePaidAgentSubscriptionSnapshot,
  isComplimentaryAgentSubscriptionSnapshot,
  resolveAgentSubscriptionPlanTier,
} from "../../../services/agentSubscriptionIncentive.service";
import { UserSubscriptionSnapshotService } from "../../../services/userSubscriptionSnapshot.service";

function daysUntil(deadline: Date | null): number | null {
  if (!deadline) return null;
  const ms = deadline.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/**
 * GET /account/agent/eligibility
 * Agent dashboard policy snapshot: KYC grace, trial window, subscription gate, and incentives.
 */
export const getAgentEligibility = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    const userType = (req.user as { userType?: string })?.userType;

    if (!userId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
    }
    if (userType !== "Agent") {
      throw new RouteError(HttpStatusCodes.FORBIDDEN, "Eligibility applies to Agent accounts only.");
    }

    const [kycStatus, ownedProperties, gate, paidSubscription, anyActiveSubscription] =
      await Promise.all([
        getPublisherKycStatus(String(userId)),
        countAgentOwnedProperties(String(userId)),
        getAgentAccessGate(String(userId)),
        getActivePaidAgentSubscriptionSnapshot(String(userId)),
        UserSubscriptionSnapshotService.getActiveSnapshot(String(userId)),
      ]);

    const kycApproved = kycStatus === "approved";
    const kycGraceActive = await isAgentKycGraceActive(String(userId));
    const trialActive = await isAgentTrialPeriodActive(String(userId));
    const subscriptionRequired = await isAgentSubscriptionRequired(String(userId));
    const kycRequirementSatisfied = await isAgentKycRequirementSatisfied(String(userId));

    const kycGraceDeadline = await getAgentKycGraceDeadline(String(userId));
    const trialDeadline = await getAgentTrialDeadline(String(userId));

    const complimentarySubscription = anyActiveSubscription
      ? await isComplimentaryAgentSubscriptionSnapshot(anyActiveSubscription)
      : false;

    const listingLimitDuringGrace = kycGraceActive && !kycApproved
      ? AGENT_KYC_GRACE_MAX_PROPERTIES_WITHOUT_APPROVAL
      : null;
    const listingLimitDuringTrial =
      kycApproved && trialActive && !paidSubscription
        ? AGENT_TRIAL_MAX_PROPERTIES_WITHOUT_SUBSCRIPTION
        : null;

    const effectiveListingLimit = paidSubscription
      ? null
      : listingLimitDuringGrace ?? listingLimitDuringTrial;

    const policyPhase = (() => {
      if (!kycRequirementSatisfied) return "kyc_blocked";
      if (kycGraceActive && !kycApproved) return "kyc_grace";
      if (subscriptionRequired && !paidSubscription) return "subscription_required";
      if (paidSubscription) return "subscribed";
      if (trialActive && kycApproved) return "trial";
      return "active";
    })();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Agent eligibility fetched successfully",
      data: {
        kycStatus,
        kycApproved,
        kycGraceActive,
        kycGraceDaysRemaining: daysUntil(kycGraceDeadline),
        kycGraceDeadline,
        trialActive,
        trialDaysRemaining: daysUntil(trialDeadline),
        trialDeadline,
        ownedProperties,
        listingLimit: effectiveListingLimit,
        listingsRemaining:
          effectiveListingLimit != null
            ? Math.max(0, effectiveListingLimit - ownedProperties)
            : paidSubscription
              ? null
              : null,
        subscriptionRequired,
        hasPaidSubscription: !!paidSubscription,
        hasComplimentarySubscription: complimentarySubscription,
        unlimitedListings: !!paidSubscription,
        canListProperties: gate.ok,
        canUseDealSite: gate.ok,
        canRequestToMarket: gate.ok,
        canSubscribe: kycApproved,
        gate:
          gate.ok === false
            ? { ok: false as const, reason: gate.reason, message: gate.message }
            : { ok: true as const },
        policyPhase,
        constants: {
          kycGracePeriodDays: AGENT_KYC_GRACE_PERIOD_DAYS,
          kycGraceMaxPropertiesWithoutApproval: AGENT_KYC_GRACE_MAX_PROPERTIES_WITHOUT_APPROVAL,
          trialPeriodDays: AGENT_TRIAL_PERIOD_DAYS,
          trialMaxPropertiesWithoutSubscription: AGENT_TRIAL_MAX_PROPERTIES_WITHOUT_SUBSCRIPTION,
        },
        subscriptionIncentives: {
          monthlyBonusDays: AGENT_SUBSCRIPTION_BONUS_DAYS.monthly,
          quarterlyBonusDays: AGENT_SUBSCRIPTION_BONUS_DAYS.quarterly,
          halfYearlyBonusDays: AGENT_SUBSCRIPTION_BONUS_DAYS.halfYearly,
          yearlyBonusDays: AGENT_SUBSCRIPTION_BONUS_DAYS.yearly,
        },
        paidSubscription: paidSubscription
          ? {
              expiresAt: paidSubscription.expiresAt,
              bonusDays: paidSubscription.meta?.bonusDays ?? null,
              planCode: paidSubscription.meta?.planCode ?? null,
              planName: paidSubscription.meta?.appliedPlanName ?? null,
            }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
};

/** Resolve bonus days label for a plan (used by plan catalog enrichment if needed). */
export function getPlanBonusDaysForDisplay(input: {
  planName?: string;
  planCode?: string;
  durationInDays?: number;
}): number {
  const tier = resolveAgentSubscriptionPlanTier(input);
  if (!tier) return 0;
  return AGENT_SUBSCRIPTION_BONUS_DAYS[tier];
}
