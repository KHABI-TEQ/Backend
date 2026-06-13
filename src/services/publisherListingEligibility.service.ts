import { Types } from "mongoose";
import { DB } from "../controllers";
import HttpStatusCodes from "../common/HttpStatusCodes";
import { RouteError } from "../common/classes";
import {
  isPublisherUserType,
  isUnlimitedListingPlanCode,
  LISTING_LIMIT_SPECIAL_PLAN_CODE,
  PUBLISHER_LISTING_LIMIT_MESSAGE,
  PUBLISHER_STANDARD_LISTING_LIMIT,
  SPECIAL_UNLIMITED_LISTINGS_PLAN_CODE,
  SPECIAL_UNLIMITED_LISTINGS_PLAN_NAME,
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

async function snapshotGrantsUnlimitedListings(
  userId: string
): Promise<boolean> {
  const snapshot = await UserSubscriptionSnapshotService.getActiveSnapshot(userId);
  if (!snapshot) return false;

  const plan = await DB.Models.SubscriptionPlan.findById(snapshot.plan)
    .select("code unlimitedListings hiddenFromCatalog")
    .lean();

  if (!plan) return false;
  if (plan.unlimitedListings || isUnlimitedListingPlanCode(plan.code)) {
    return true;
  }

  const planCode = snapshot.meta?.planCode ?? plan.code;
  return isUnlimitedListingPlanCode(planCode);
}

export async function publisherHasUnlimitedListings(userId: string): Promise<boolean> {
  return snapshotGrantsUnlimitedListings(userId);
}

export interface PublisherListingSnapshot {
  ownedProperties: number;
  listingLimit: number | null;
  listingsRemaining: number | null;
  unlimitedListings: boolean;
  canListProperties: boolean;
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
  const unlimitedListings = await publisherHasUnlimitedListings(userId);
  const listingLimit = unlimitedListings ? null : PUBLISHER_STANDARD_LISTING_LIMIT;
  const listingsRemaining =
    listingLimit != null ? Math.max(0, listingLimit - ownedProperties) : null;
  const requiresSpecialPlan =
    !unlimitedListings && ownedProperties >= PUBLISHER_STANDARD_LISTING_LIMIT;

  return {
    ownedProperties,
    listingLimit,
    listingsRemaining,
    unlimitedListings,
    canListProperties: unlimitedListings || ownedProperties < PUBLISHER_STANDARD_LISTING_LIMIT,
    requiresSpecialPlan,
    specialPlanCode: SPECIAL_UNLIMITED_LISTINGS_PLAN_CODE,
    specialPlanName: SPECIAL_UNLIMITED_LISTINGS_PLAN_NAME,
  };
}

export function buildListingLimitRouteErrorDetails(
  ownedProperties: number
): string {
  return JSON.stringify({
    code: LISTING_LIMIT_SPECIAL_PLAN_CODE,
    ownedProperties,
    listingLimit: PUBLISHER_STANDARD_LISTING_LIMIT,
    specialPlanCode: SPECIAL_UNLIMITED_LISTINGS_PLAN_CODE,
    specialPlanName: SPECIAL_UNLIMITED_LISTINGS_PLAN_NAME,
  });
}

/** Blocks the 26th+ listing unless Portfolio Unlimited is active. */
export async function assertPublisherListingCapacity(params: {
  ownerId: Types.ObjectId | string;
  userType: string;
}): Promise<void> {
  const { ownerId, userType } = params;
  if (!isPublisherUserType(userType)) return;

  if (await publisherHasUnlimitedListings(String(ownerId))) return;

  const owned = await countPublisherOwnedProperties(ownerId);
  if (owned >= PUBLISHER_STANDARD_LISTING_LIMIT) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      PUBLISHER_LISTING_LIMIT_MESSAGE,
      buildListingLimitRouteErrorDetails(owned)
    );
  }
}
