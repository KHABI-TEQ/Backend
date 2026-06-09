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

/** @deprecated Agent trial allows up to 10 properties; kept for legacy imports. */
export const FREE_PROPERTY_LIMIT = 1;

/** @deprecated Use FREE_PROPERTY_LIMIT */
export const FREE_PROPERTY_LIMIT_AGENT_DEVELOPER = FREE_PROPERTY_LIMIT;

export type ActiveSnapshot = IUserSubscriptionSnapshotDoc | null;

/**
 * Agent — 7-day KYC grace, then approved KYC required; 4-week trial up to 10 listings without subscription.
 * Developer / Landowner — no KYC or subscription checks.
 */
export async function assertPropertyListingAllowedForOwner(params: {
  ownerId: Types.ObjectId | string;
  userType: string;
}): Promise<{ activeSnapshot: ActiveSnapshot }> {
  const { ownerId, userType } = params;
  const ownerIdStr = ownerId.toString();

  if (userType === "Developer" || userType === "Landowners") {
    return { activeSnapshot: null };
  }

  if (userType !== "Agent") {
    return { activeSnapshot: null };
  }

  const gate = await getAgentAccessGate(ownerIdStr);
  if (gate.ok === false) {
    throw new RouteError(HttpStatusCodes.FORBIDDEN, gate.message);
  }

  if (await isAgentKycGraceListingLimitReached(ownerIdStr)) {
    throw new RouteError(HttpStatusCodes.FORBIDDEN, AGENT_KYC_GRACE_PROPERTY_LIMIT_MESSAGE);
  }

  const activeSnapshot = await UserSubscriptionSnapshotService.getActiveSnapshot(ownerIdStr);
  return { activeSnapshot };
}
