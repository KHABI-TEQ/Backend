import { DB } from "../controllers";

export type DealSiteReconciliationResult = {
  scanned: number;
  paused: number;
  skippedNoOwner: number;
  skippedBelowPropertyThreshold: number;
  skippedHasActiveSubscription: number;
};

/**
 * Reconcile running DealSites against subscription state.
 * Rule: if owner has 2+ non-deleted owned properties and no active subscription,
 * pause the DealSite.
 */
export const reconcileRunningDealSitesWithoutActiveSubscription = async (): Promise<DealSiteReconciliationResult> => {
  const runningDealSites = await DB.Models.DealSite.find({ status: "running" })
    .select("_id createdBy publicSlug status")
    .lean();

  const result: DealSiteReconciliationResult = {
    scanned: runningDealSites.length,
    paused: 0,
    skippedNoOwner: 0,
    skippedBelowPropertyThreshold: 0,
    skippedHasActiveSubscription: 0,
  };

  for (const site of runningDealSites) {
    const ownerId = site.createdBy;
    if (!ownerId) {
      result.skippedNoOwner += 1;
      continue;
    }

    const propertyCount = await DB.Models.Property.countDocuments({
      owner: ownerId,
      isDeleted: { $ne: true },
    });

    if (propertyCount < 2) {
      result.skippedBelowPropertyThreshold += 1;
      continue;
    }

    const activeSubCount = await DB.Models.UserSubscriptionSnapshot.countDocuments({
      user: ownerId,
      status: "active",
    });

    if (activeSubCount > 0) {
      result.skippedHasActiveSubscription += 1;
      continue;
    }

    const updateResult = await DB.Models.DealSite.updateOne(
      { _id: site._id, status: "running" },
      { $set: { status: "paused" } }
    );

    if (updateResult.modifiedCount > 0) {
      result.paused += 1;
    }
  }

  return result;
};
