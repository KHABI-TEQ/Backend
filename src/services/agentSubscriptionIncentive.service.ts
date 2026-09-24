import { DB } from "../controllers";
import { IUserSubscriptionSnapshotDoc } from "../models";
import { UserSubscriptionSnapshotService } from "./userSubscriptionSnapshot.service";

/** Complimentary extra days are cancelled. Plan duration is exact. */
export const AGENT_SUBSCRIPTION_BONUS_DAYS = {
  monthly: 0,
  quarterly: 0,
  halfYearly: 0,
  yearly: 0,
} as const;

export type AgentSubscriptionPlanTier =
  | "monthly"
  | "quarterly"
  | "halfYearly"
  | "yearly";

function addCalendarDays(from: Date, days: number): Date {
  const result = new Date(from);
  result.setDate(result.getDate() + days);
  return result;
}

function normalizePlanToken(value: string | undefined | null): string {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * Resolve plan tier from name/code/duration for incentive bonus calculation.
 */
export function resolveAgentSubscriptionPlanTier(input: {
  planName?: string;
  planCode?: string;
  durationInDays?: number;
}): AgentSubscriptionPlanTier | null {
  const name = normalizePlanToken(input.planName);
  const code = normalizePlanToken(input.planCode);
  const duration = input.durationInDays;

  if (
    name.includes("year") ||
    code.includes("year") ||
    name.includes("annual") ||
    code.includes("annual") ||
    (duration != null && duration >= 300)
  ) {
    return "yearly";
  }

  if (
    name.includes("half") ||
    code.includes("half") ||
    name.includes("semi") ||
    code.includes("semi") ||
    (duration != null && duration >= 150 && duration < 300)
  ) {
    return "halfYearly";
  }

  if (
    name.includes("quarter") ||
    code.includes("quarter") ||
    (duration != null && duration >= 80 && duration < 150)
  ) {
    return "quarterly";
  }

  if (
    name.includes("month") ||
    code.includes("month") ||
    (duration != null && duration >= 20 && duration < 80)
  ) {
    return "monthly";
  }

  return null;
}

/** Complimentary extra days are cancelled. Always 0. */
export function resolveAgentSubscriptionBonusDays(_input: {
  planName?: string;
  planCode?: string;
  durationInDays?: number;
  category?: string;
}): number {
  return 0;
}

/** Subscription validity is the purchased plan duration only. */
export function computePaidSubscriptionExpiresAt(input: {
  startDate: Date;
  baseDurationInDays: number;
  planName?: string;
  planCode?: string;
  category?: string;
}): { expiresAt: Date; bonusDays: number } {
  const days = Math.max(1, Number(input.baseDurationInDays) || 0);
  return { expiresAt: addCalendarDays(input.startDate, days), bonusDays: 0 };
}

/** True when the snapshot represents a complimentary KYC/free-trial grant (not a paid plan). */
export async function isComplimentaryAgentSubscriptionSnapshot(
  snapshot: IUserSubscriptionSnapshotDoc | null
): Promise<boolean> {
  if (!snapshot) {
    return false;
  }

  if (snapshot.meta?.planType === "Free Plan") {
    return true;
  }

  const plan = await DB.Models.SubscriptionPlan.findById(snapshot.plan)
    .select("isTrial price")
    .lean();

  if (plan?.isTrial || plan?.price === 0) {
    return true;
  }

  const transaction = await DB.Models.NewTransaction.findById(snapshot.transaction)
    .select("amount paymentMode status")
    .lean();

  if (!transaction) {
    return false;
  }

  return transaction.paymentMode === "kyc approval" || Number(transaction.amount) <= 0;
}

/**
 * Active paid subscription for an Agent (excludes complimentary KYC/free-trial grants).
 */
export async function getActivePaidAgentSubscriptionSnapshot(
  userId: string
): Promise<IUserSubscriptionSnapshotDoc | null> {
  const snapshots = await UserSubscriptionSnapshotService.getActiveSnapshots(userId);
  for (const snapshot of snapshots) {
    if (!(await isComplimentaryAgentSubscriptionSnapshot(snapshot))) {
      return snapshot;
    }
  }
  return null;
}

import { publisherHasUnlimitedListings } from "./publisherListingEligibility.service";

/** Portfolio Unlimited is retired. Always false. */
export async function agentHasUnlimitedPropertyListings(userId: string): Promise<boolean> {
  return publisherHasUnlimitedListings(userId);
}
