import { Types } from "mongoose";
import HttpStatusCodes from "../common/HttpStatusCodes";
import { RouteError } from "../common/classes";
import { UserSubscriptionSnapshotService } from "./userSubscriptionSnapshot.service";
import type { IUserSubscriptionSnapshotDoc } from "../models";
import {
  getAgentAccessGate,
  SUBSCRIPTION_REQUIRED_TO_LIST_MESSAGE,
} from "./agentPublisherEligibility.service";
import { getActivePaidAgentSubscriptionSnapshot } from "./agentSubscriptionIncentive.service";
import { assertPublisherListingCapacity } from "./publisherListingEligibility.service";
import { isPublisherUserType } from "../common/constants/publisherListingLimits";

/** @deprecated Use PUBLISHER_STANDARD_LISTING_LIMIT from publisherListingLimits. */
export const FREE_PROPERTY_LIMIT = 0;

/** @deprecated Use PUBLISHER_STANDARD_LISTING_LIMIT */
export const FREE_PROPERTY_LIMIT_AGENT_DEVELOPER = FREE_PROPERTY_LIMIT;

export type ActiveSnapshot = IUserSubscriptionSnapshotDoc | null;

/**
 * Publishers (Agent, Developer, Landowner, Property Scout) must have a paid
 * subscription to list. Agents also need approved KYC. Listing volume is then
 * capped by the active plan (25 on quarterly, 50 on the Licensed Agent annual plan).
 */
export async function assertPropertyListingAllowedForOwner(params: {
  ownerId: Types.ObjectId | string;
  userType: string;
}): Promise<{ activeSnapshot: ActiveSnapshot }> {
  const { ownerId, userType } = params;
  const ownerIdStr = ownerId.toString();

  if (isPublisherUserType(userType)) {
    if (userType === "Agent") {
      const gate = await getAgentAccessGate(ownerIdStr);
      if (gate.ok === false) {
        throw new RouteError(HttpStatusCodes.FORBIDDEN, gate.message);
      }
    } else {
      const paid = await getActivePaidAgentSubscriptionSnapshot(ownerIdStr);
      if (!paid) {
        throw new RouteError(HttpStatusCodes.FORBIDDEN, SUBSCRIPTION_REQUIRED_TO_LIST_MESSAGE);
      }
    }
  }

  await assertPublisherListingCapacity({ ownerId, userType });

  const activeSnapshot = isPublisherUserType(userType)
    ? await UserSubscriptionSnapshotService.getActiveSnapshot(ownerIdStr)
    : null;

  return { activeSnapshot };
}
