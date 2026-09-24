import { Types } from "mongoose";
import { DB } from "../controllers";
import HttpStatusCodes from "../common/HttpStatusCodes";
import { RouteError } from "../common/classes";
import {
  isPublisherUserType,
  listingLimitForPlanCode,
  listingLimitMessage,
  LISTING_LIMIT_SPECIAL_PLAN_CODE,
  PUBLISHER_STANDARD_LISTING_LIMIT,
} from "../common/constants/publisherListingLimits";
import { UserSubscriptionSnapshotService } from "./userSubscriptionSnapshot.service";

export async function countPublisherOwnedProperties(
  ownerId: Types.ObjectId | string
): Promise<number> {
  return DB.Models.Property.countDocuments({
    owner: ownerId,
    isDeleted: { $ne: true },
  });
}

export async function resolvePublisherListingLimit(userId: string): Promise<number> {
  const snapshots = await UserSubscriptionSnapshotService.getActiveSnapshots(userId);
  if (!snapshots.length) return PUBLISHER_STANDARD_LISTING_LIMIT;

  let maxLimit = 0;
  for (const snapshot of snapshots) {
    const plan = await DB.Models.SubscriptionPlan.findById(snapshot.plan)
      .select("code listingLimit discountedPlans.code discountedPlans.listingLimit")
      .lean();
    const planCode = String(snapshot.meta?.planCode || plan?.code || "").toUpperCase();
    const discounted = plan?.discountedPlans?.find(
      (dp) => String(dp.code || "").toUpperCase() === planCode
    );
    const explicit =
      snapshot.meta?.listingLimit && Number(snapshot.meta.listingLimit) > 0
        ? Number(snapshot.meta.listingLimit)
        : discounted?.listingLimit && discounted.listingLimit > 0
          ? discounted.listingLimit
          : plan?.listingLimit && plan.listingLimit > 0
            ? plan.listingLimit
            : null;
    maxLimit = Math.max(maxLimit, listingLimitForPlanCode(planCode, explicit));
  }

  return maxLimit || PUBLISHER_STANDARD_LISTING_LIMIT;
}

/** Portfolio Unlimited is retired — never grant an uncapped listing allowance. */
export async function publisherHasUnlimitedListings(_userId: string): Promise<boolean> {
  return false;
}

export interface PublisherListingSnapshot {
  ownedProperties: number;
  listingLimit: number | null;
  listingsRemaining: number | null;
  unlimitedListings: boolean;
  canListProperties: boolean;
  hasPaidSubscription: boolean;
  requiresActiveSubscription: boolean;
  requiresSpecialPlan: boolean;
  specialPlanCode: string;
  specialPlanName: string;
}

export async function getPublisherListingSnapshot(
  userId: string,
  userType: string
): Promise<PublisherListingSnapshot | null> {
  if (!isPublisherUserType(userType)) return null;

  const ownedProperties = await countPublisherOwnedProperties(userId);
  const { getActivePaidAgentSubscriptionSnapshot } = await import(
    "./agentSubscriptionIncentive.service"
  );
  const [listingLimit, paidSubscription] = await Promise.all([
    resolvePublisherListingLimit(userId),
    getActivePaidAgentSubscriptionSnapshot(userId),
  ]);
  const hasPaidSubscription = !!paidSubscription;
  const listingsRemaining = Math.max(0, listingLimit - ownedProperties);
  const atCap = hasPaidSubscription && ownedProperties >= listingLimit;

  return {
    ownedProperties,
    listingLimit,
    listingsRemaining,
    unlimitedListings: false,
    hasPaidSubscription,
    requiresActiveSubscription: !hasPaidSubscription,
    canListProperties: hasPaidSubscription && ownedProperties < listingLimit,
    requiresSpecialPlan: atCap,
    specialPlanCode: LISTING_LIMIT_SPECIAL_PLAN_CODE,
    specialPlanName: "Listing allowance",
  };
}

export function buildListingLimitRouteErrorDetails(
  ownedProperties: number,
  listingLimit: number
): string {
  return JSON.stringify({
    code: LISTING_LIMIT_SPECIAL_PLAN_CODE,
    ownedProperties,
    listingLimit,
  });
}

export async function assertPublisherListingCapacity(params: {
  ownerId: Types.ObjectId | string;
  userType: string;
}): Promise<void> {
  const { ownerId, userType } = params;
  if (!isPublisherUserType(userType)) return;

  const listingLimit = await resolvePublisherListingLimit(String(ownerId));
  const owned = await countPublisherOwnedProperties(ownerId);
  if (owned >= listingLimit) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      listingLimitMessage(listingLimit),
      buildListingLimitRouteErrorDetails(owned, listingLimit)
    );
  }
}
