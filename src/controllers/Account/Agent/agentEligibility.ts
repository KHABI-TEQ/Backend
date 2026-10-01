import { Response, NextFunction } from "express";
import { DB } from "../..";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import {
  countAgentOwnedProperties,
  getAgentAccessGate,
  SUBSCRIPTION_REQUIRED_TO_LIST_MESSAGE,
} from "../../../services/agentPublisherEligibility.service";
import { getPublisherKycStatus } from "../../../services/publisherKyc.service";
import { buildKycNotice } from "../../../services/kycNotice.service";
import {
  AGENT_SUBSCRIPTION_BONUS_DAYS,
  getActivePaidAgentSubscriptionSnapshot,
  resolveAgentSubscriptionPlanTier,
} from "../../../services/agentSubscriptionIncentive.service";
import { getPublisherListingSnapshot } from "../../../services/publisherListingEligibility.service";
import { getPropertyScoutSnapshot } from "../../../services/propertyScout.service";

/**
 * GET /account/agent/eligibility
 * Agent dashboard policy snapshot. Paid subscription is required to list and to run a practitioner page.
 * Pending KYC only blocks accepting, rejecting, or updating a client inspection request.
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
      account,
    ] = await Promise.all([
      getPublisherKycStatus(String(userId)),
      countAgentOwnedProperties(String(userId)),
      getAgentAccessGate(String(userId)),
      getActivePaidAgentSubscriptionSnapshot(String(userId)),
      getPublisherListingSnapshot(String(userId), "Agent"),
      getPropertyScoutSnapshot(String(userId)),
      DB.Models.User.findById(userId).select("kycNoticeDismissedStatus").lean(),
    ]);

    const kycApproved = kycStatus === "approved";
    const hasPaidSubscription = !!paidSubscription;
    const subscriptionRequired = !hasPaidSubscription;

    const policyPhase = subscriptionRequired ? "subscription_required" : "subscribed";
    const canRespondToInspectionRequests =
      kycApproved && !propertyScout.isPropertyScout;
    const kycOverlay = buildKycNotice({
      kycStatus,
      dismissedStatus: account?.kycNoticeDismissedStatus,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Agent eligibility fetched successfully",
      data: {
        kycStatus,
        kycApproved,
        kycNotice: kycOverlay,
        kycOverlay,
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
        canSetupPractitionerPage: gate.ok,
        canOpenPractitionerPage: gate.ok,
        canRequestToMarket: gate.ok,
        canSubscribe: true,
        kycBlocksInspectionRequestsOnly: true,
        canRespondToInspectionRequests,
        isPropertyScout: propertyScout.isPropertyScout,
        isLicensedPublisher: propertyScout.isLicensedPublisher,
        displayRoleLabel: propertyScout.displayRoleLabel,
        hasLicense: propertyScout.hasLicense,
        canAcceptInspectionRequests: canRespondToInspectionRequests,
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
          monthlyBonusDays: 0,
          quarterlyBonusDays: 0,
          halfYearlyBonusDays: 0,
          yearlyBonusDays: 0,
        },
        paidSubscription: paidSubscription
          ? {
              expiresAt: paidSubscription.expiresAt,
              bonusDays: null,
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
