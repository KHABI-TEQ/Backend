import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import {
  countAgentOwnedProperties,
  getAgentAccessGate,
  isAgentKycRequirementSatisfied,
  SUBSCRIPTION_REQUIRED_TO_LIST_MESSAGE,
} from "../../../services/agentPublisherEligibility.service";
import { getPublisherKycStatus } from "../../../services/publisherKyc.service";
import {
  AGENT_SUBSCRIPTION_BONUS_DAYS,
  getActivePaidAgentSubscriptionSnapshot,
  resolveAgentSubscriptionPlanTier,
} from "../../../services/agentSubscriptionIncentive.service";
import { getPublisherListingSnapshot } from "../../../services/publisherListingEligibility.service";
import { getPropertyScoutSnapshot } from "../../../services/propertyScout.service";

/**
 * GET /account/agent/eligibility
 * Agent dashboard policy snapshot: KYC + paid subscription required to list.
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

    const [
      kycStatus,
      ownedProperties,
      gate,
      paidSubscription,
      publisherListing,
      propertyScout,
      kycRequirementSatisfied,
    ] = await Promise.all([
      getPublisherKycStatus(String(userId)),
      countAgentOwnedProperties(String(userId)),
      getAgentAccessGate(String(userId)),
      getActivePaidAgentSubscriptionSnapshot(String(userId)),
      getPublisherListingSnapshot(String(userId), "Agent"),
      getPropertyScoutSnapshot(String(userId)),
      isAgentKycRequirementSatisfied(String(userId)),
    ]);

    const kycApproved = kycStatus === "approved";
    const hasPaidSubscription = !!paidSubscription;
    const subscriptionRequired = !hasPaidSubscription;

    const policyPhase = (() => {
      if (!kycRequirementSatisfied) return "kyc_blocked";
      if (subscriptionRequired) return "subscription_required";
      if (hasPaidSubscription) return "subscribed";
      return "active";
    })();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Agent eligibility fetched successfully",
      data: {
        kycStatus,
        kycApproved,
        kycGraceActive: false,
        kycGraceDaysRemaining: null,
        kycGraceDeadline: null,
        trialActive: false,
        trialDaysRemaining: null,
        trialDeadline: null,
        ownedProperties,
        listingLimit: publisherListing?.listingLimit ?? null,
        listingsRemaining: publisherListing?.listingsRemaining ?? null,
        subscriptionRequired,
        hasPaidSubscription,
        hasComplimentarySubscription: false,
        unlimitedListings: publisherListing?.unlimitedListings ?? false,
        requiresSpecialPlan: publisherListing?.requiresSpecialPlan ?? false,
        specialPlanCode: publisherListing?.specialPlanCode ?? null,
        specialPlanName: publisherListing?.specialPlanName ?? null,
        canListProperties: gate.ok && (publisherListing?.canListProperties ?? false),
        canUseDealSite: gate.ok,
        canRequestToMarket: gate.ok,
        canSubscribe: true,
        isPropertyScout: propertyScout.isPropertyScout,
        isLicensedPublisher: propertyScout.isLicensedPublisher,
        displayRoleLabel: propertyScout.displayRoleLabel,
        hasLicense: propertyScout.hasLicense,
        canAcceptInspectionRequests: !propertyScout.isPropertyScout,
        gate:
          gate.ok === false
            ? { ok: false as const, reason: gate.reason, message: gate.message }
            : { ok: true as const },
        policyPhase,
        constants: {
          kycGracePeriodDays: 0,
          kycGraceMaxPropertiesWithoutApproval: 0,
          trialPeriodDays: 0,
          trialMaxPropertiesWithoutSubscription: 0,
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
        listingPolicyMessage: subscriptionRequired
          ? SUBSCRIPTION_REQUIRED_TO_LIST_MESSAGE
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
