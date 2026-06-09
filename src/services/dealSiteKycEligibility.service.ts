import { DB } from "../controllers";
import HttpStatusCodes from "../common/HttpStatusCodes";
import { RouteError } from "../common/classes";
import {
  getAgentAccessGate,
  isAgentKycRequirementSatisfied,
} from "./agentPublisherEligibility.service";

/** @deprecated Use AGENT_KYC_GRACE_PERIOD_DAYS from agentPublisherEligibility.service */
export const DEALSITE_KYC_GRACE_PERIOD_DAYS = 7;

export type DealSiteKycReconciliationResult = {
  scanned: number;
  paused: number;
  resumed: number;
  skippedEligible: number;
  skippedNotAgent: number;
  skippedNoOwner: number;
};

function isAgentUserType(userType: string | undefined): boolean {
  return userType === "Agent";
}

/** Blocks Agent DealSite setup/enable when KYC or trial/subscription rules fail. */
export async function assertDealSiteKycAllowed(userId: string): Promise<void> {
  const user = await DB.Models.User.findById(userId).select("userType").lean();
  if (!user || user.userType !== "Agent") {
    return;
  }

  const gate = await getAgentAccessGate(userId);
  if (gate.ok === false) {
    throw new RouteError(HttpStatusCodes.FORBIDDEN, gate.message);
  }
}

export async function getPublicDealSiteKycGate(
  ownerUserId: string
): Promise<
  | { readonly ok: true }
  | { readonly ok: false; readonly errorCode: "KYC_REQUIRED" | "SUBSCRIPTION_REQUIRED"; readonly message: string }
> {
  const owner = await DB.Models.User.findById(ownerUserId).select("userType").lean();
  if (!owner || owner.userType !== "Agent") {
    return { ok: true } as const;
  }

  const gate = await getAgentAccessGate(ownerUserId);
  if (gate.ok === false) {
    return {
      ok: false,
      errorCode: gate.reason === "kyc" ? "KYC_REQUIRED" : "SUBSCRIPTION_REQUIRED",
      message: gate.message,
    } as const;
  }

  return { ok: true } as const;
}

async function pauseAgentDealSiteForPolicy(
  siteId: unknown,
  reason: "kyc" | "subscription"
): Promise<boolean> {
  const updateResult = await DB.Models.DealSite.updateOne(
    { _id: siteId, status: "running" },
    { $set: { status: "paused", pausedByPolicy: reason } }
  );
  return updateResult.modifiedCount > 0;
}

async function resumeAgentDealSiteIfPolicyPaused(siteId: unknown): Promise<boolean> {
  const updateResult = await DB.Models.DealSite.updateOne(
    { _id: siteId, status: "paused", pausedByPolicy: { $in: ["kyc", "subscription"] } },
    { $set: { status: "running" }, $unset: { pausedByPolicy: "" } }
  );
  return updateResult.modifiedCount > 0;
}

/**
 * Pause running Agent DealSites that fail KYC/subscription rules; auto-resume policy-paused
 * sites when the owner becomes eligible again.
 */
export async function reconcileRunningDealSitesWithoutKycApproval(): Promise<DealSiteKycReconciliationResult> {
  const dealSites = await DB.Models.DealSite.find({
    status: { $in: ["running", "paused"] },
  })
    .select("_id createdBy publicSlug status pausedByPolicy")
    .lean();

  const result: DealSiteKycReconciliationResult = {
    scanned: dealSites.length,
    paused: 0,
    resumed: 0,
    skippedEligible: 0,
    skippedNotAgent: 0,
    skippedNoOwner: 0,
  };

  for (const site of dealSites) {
    const ownerId = site.createdBy;
    if (!ownerId) {
      result.skippedNoOwner += 1;
      continue;
    }

    const ownerIdStr = String(ownerId);
    const owner = await DB.Models.User.findById(ownerId).select("userType").lean();
    if (!owner || !isAgentUserType(owner.userType)) {
      result.skippedNotAgent += 1;
      continue;
    }

    const gate = await getAgentAccessGate(ownerIdStr);
    if (gate.ok === false) {
      if (site.status === "running") {
        const paused = await pauseAgentDealSiteForPolicy(site._id, gate.reason);
        if (paused) {
          result.paused += 1;
        }
      }
      continue;
    }

    if (site.status === "paused" && site.pausedByPolicy) {
      const resumed = await resumeAgentDealSiteIfPolicyPaused(site._id);
      if (resumed) {
        result.resumed += 1;
      }
    } else {
      result.skippedEligible += 1;
    }
  }

  return result;
}

/** @deprecated Use isAgentKycRequirementSatisfied — kept for any external imports. */
export async function isDealSiteKycGraceActive(userId: string): Promise<boolean> {
  return isAgentKycRequirementSatisfied(userId);
}
