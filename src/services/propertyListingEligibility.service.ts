import { Types } from "mongoose";
import HttpStatusCodes from "../common/HttpStatusCodes";
import { RouteError } from "../common/classes";
import { UserSubscriptionSnapshotService } from "./userSubscriptionSnapshot.service";
import type { IUserSubscriptionSnapshotDoc } from "../models";
import {
  AGENT_KYC_GRACE_PROPERTY_LIMIT_MESSAGE,
  getAgentAccessGate,
  isAgentKycGraceListingLimitReached,
} from "./agentPublisherEligibility.service";
import { assertPublisherListingCapacity } from "./publisherListingEligibility.service";

/** @deprecated Use PUBLISHER_STANDARD_LISTING_LIMIT from publisherListingLimits. */
export const FREE_PROPERTY_LIMIT = 1;

/** @deprecated Use PUBLISHER_STANDARD_LISTING_LIMIT */
export const FREE_PROPERTY_LIMIT_AGENT_DEVELOPER = FREE_PROPERTY_LIMIT;

export type ActiveSnapshot = IUserSubscriptionSnapshotDoc | null;

/**
 * Landlord / Developer / Agent — standard 25 listing cap unless Portfolio Unlimited is active.
 * Agent — also subject to KYC grace and trial/subscription gates.
 */
export async function assertPropertyListingAllowedForOwner(params: {
  ownerId: Types.ObjectId | string;
  userType: string;
}): Promise<{ activeSnapshot: ActiveSnapshot }> {
  const { ownerId, userType } = params;
  const ownerIdStr = ownerId.toString();

  if (userType === "Agent") {
    const gate = await getAgentAccessGate(ownerIdStr);
    if (gate.ok === false) {
      throw new RouteError(HttpStatusCodes.FORBIDDEN, gate.message);
    }

    if (await isAgentKycGraceListingLimitReached(ownerIdStr)) {
      throw new RouteError(HttpStatusCodes.FORBIDDEN, AGENT_KYC_GRACE_PROPERTY_LIMIT_MESSAGE);
    }
  }

  await assertPublisherListingCapacity({ ownerId, userType });

  const activeSnapshot =
    userType === "Agent"
      ? await UserSubscriptionSnapshotService.getActiveSnapshot(ownerIdStr)
      : null;

  return { activeSnapshot };
}
