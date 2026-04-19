import { Types } from "mongoose";
import { DB } from "../controllers";
import HttpStatusCodes from "../common/HttpStatusCodes";
import { RouteError } from "../common/classes";
import { UserSubscriptionSnapshotService } from "./userSubscriptionSnapshot.service";
import type { IUserSubscriptionSnapshotDoc } from "../models";

/** First N listings for Agent/Developer do not require a subscription. */
export const FREE_PROPERTY_LIMIT_AGENT_DEVELOPER = 1;

export type ActiveSnapshot = IUserSubscriptionSnapshotDoc | null;

/**
 * Enforces: Landowners — unlimited (no snapshot).
 * Agent/Developer — first {@link FREE_PROPERTY_LIMIT_AGENT_DEVELOPER} free; beyond that requires active subscription.
 * Agent — beyond free tier also requires KYC approved.
 */
export async function assertPropertyListingAllowedForOwner(params: {
  ownerId: Types.ObjectId | string;
  userType: string;
}): Promise<{ activeSnapshot: ActiveSnapshot }> {
  const { ownerId, userType } = params;

  if (userType !== "Agent" && userType !== "Developer") {
    return { activeSnapshot: null };
  }

  const existingPropertyCount = await DB.Models.Property.countDocuments({
    owner: ownerId,
    isDeleted: { $ne: true },
  });

  if (existingPropertyCount < FREE_PROPERTY_LIMIT_AGENT_DEVELOPER) {
    return { activeSnapshot: null };
  }

  if (userType === "Agent") {
    const agent = await DB.Models.Agent.findOne({ userId: ownerId });
    if (!agent || agent.kycStatus !== "approved") {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Complete KYC verification and obtain approval before listing more than one property."
      );
    }
  }

  const activeSnapshot = await UserSubscriptionSnapshotService.getActiveSnapshot(
    ownerId.toString()
  );
  if (!activeSnapshot) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "You have reached the free limit of 1 property. Please subscribe to a plan to post more properties."
    );
  }

  return { activeSnapshot };
}
