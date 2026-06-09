import { DB } from "../controllers";
import { getAgentAccessGate } from "./agentPublisherEligibility.service";

export type DealSiteReconciliationResult = {
  scanned: number;
  paused: number;
  resumed: number;
  skippedNoOwner: number;
  skippedNotAgent: number;
  skippedEligible: number;
};

async function pauseForPolicy(siteId: unknown, reason: "subscription"): Promise<boolean> {
  const updateResult = await DB.Models.DealSite.updateOne(
    { _id: siteId, status: "running" },
    { $set: { status: "paused", pausedByPolicy: reason } }
  );
  return updateResult.modifiedCount > 0;
}

async function resumeIfPolicyPaused(siteId: unknown): Promise<boolean> {
  const updateResult = await DB.Models.DealSite.updateOne(
    { _id: siteId, status: "paused", pausedByPolicy: { $in: ["kyc", "subscription"] } },
    { $set: { status: "running" }, $unset: { pausedByPolicy: "" } }
  );
  return updateResult.modifiedCount > 0;
}

/**
 * Reconcile Agent DealSites against trial/subscription policy.
 * Developers are not subject to subscription-based DealSite pausing.
 */
export const reconcileRunningDealSitesWithoutActiveSubscription =
  async (): Promise<DealSiteReconciliationResult> => {
    const dealSites = await DB.Models.DealSite.find({
      status: { $in: ["running", "paused"] },
    })
      .select("_id createdBy status pausedByPolicy")
      .lean();

    const result: DealSiteReconciliationResult = {
      scanned: dealSites.length,
      paused: 0,
      resumed: 0,
      skippedNoOwner: 0,
      skippedNotAgent: 0,
      skippedEligible: 0,
    };

    for (const site of dealSites) {
      const ownerId = site.createdBy;
      if (!ownerId) {
        result.skippedNoOwner += 1;
        continue;
      }

      const owner = await DB.Models.User.findById(ownerId).select("userType").lean();
      if (!owner || owner.userType !== "Agent") {
        result.skippedNotAgent += 1;
        continue;
      }

      const gate = await getAgentAccessGate(String(ownerId));
      if (gate.ok) {
        if (site.status === "paused" && site.pausedByPolicy) {
          const resumed = await resumeIfPolicyPaused(site._id);
          if (resumed) {
            result.resumed += 1;
          }
        } else {
          result.skippedEligible += 1;
        }
        continue;
      }

      if (gate.ok !== false || gate.reason !== "subscription") {
        result.skippedEligible += 1;
        continue;
      }

      if (site.status === "running") {
        const paused = await pauseForPolicy(site._id, "subscription");
        if (paused) {
          result.paused += 1;
        }
      }
    }

    return result;
  };
