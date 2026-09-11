import HttpStatusCodes from "../common/HttpStatusCodes";
import { RouteError } from "../common/classes";
import {
  SUBSCRIPTION_PLAN_AUDIENCES,
  resolvePlanAudience,
  type SubscriptionPlanAudience,
} from "../common/constants/subscriptionCategories";
import { isPropertyScout } from "./propertyScout.service";

export async function resolveCatalogAudienceForUser(
  userId?: string | null,
): Promise<SubscriptionPlanAudience> {
  if (!userId) return SUBSCRIPTION_PLAN_AUDIENCES.LICENSED;
  return (await isPropertyScout(String(userId)))
    ? SUBSCRIPTION_PLAN_AUDIENCES.SCOUT
    : SUBSCRIPTION_PLAN_AUDIENCES.LICENSED;
}

export async function assertUserCanPurchasePlanAudience(input: {
  userId: string;
  planAudience?: string | null;
  planCode?: string;
}): Promise<void> {
  const audience = resolvePlanAudience(input.planAudience);
  const scout = await isPropertyScout(String(input.userId));

  if (scout && audience !== SUBSCRIPTION_PLAN_AUDIENCES.SCOUT) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "Property Scout accounts use the Property Scout Standard, Custom Domain, and Portfolio Unlimited plans. Those are priced for students and practitioners without a license.",
    );
  }

  if (!scout && audience === SUBSCRIPTION_PLAN_AUDIENCES.SCOUT) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "Property Scout plans are for Agents and Developers without a license. Use the Standard, Custom Domain, or Portfolio Unlimited plans for licensed practitioners.",
    );
  }
}
