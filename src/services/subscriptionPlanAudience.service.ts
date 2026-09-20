import HttpStatusCodes from "../common/HttpStatusCodes";
import { RouteError } from "../common/classes";
import {
  SUBSCRIPTION_PLAN_AUDIENCES,
  resolvePlanAudience,
  type SubscriptionPlanAudience,
} from "../common/constants/subscriptionCategories";
import { catalogDefinitionByCode } from "../common/constants/subscriptionCatalog";
import { isPropertyScout } from "./propertyScout.service";
import { DB } from "../controllers";

const PROFESSIONAL_USER_TYPES: Record<string, SubscriptionPlanAudience> = {
  Lawyer: SUBSCRIPTION_PLAN_AUDIENCES.LAWYER,
  Surveyor: SUBSCRIPTION_PLAN_AUDIENCES.SURVEYOR,
  Valuer: SUBSCRIPTION_PLAN_AUDIENCES.VALUER,
};

export async function resolveCatalogAudienceForUser(
  userId?: string | null,
): Promise<SubscriptionPlanAudience> {
  if (!userId) return SUBSCRIPTION_PLAN_AUDIENCES.LICENSED;
  const user = await DB.Models.User.findById(userId).select("userType").lean();
  const userType = String(user?.userType || "");

  if (userType === "Developer" || userType === "Landowners") {
    return SUBSCRIPTION_PLAN_AUDIENCES.DEVELOPER;
  }
  if (PROFESSIONAL_USER_TYPES[userType]) {
    return PROFESSIONAL_USER_TYPES[userType];
  }
  if (userType === "PropertyScout") {
    return SUBSCRIPTION_PLAN_AUDIENCES.SCOUT;
  }
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
  const user = await DB.Models.User.findById(input.userId).select("userType").lean();
  const userType = String(user?.userType || "");

  if (userType === "Developer") {
    if (audience !== SUBSCRIPTION_PLAN_AUDIENCES.DEVELOPER) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Developer accounts use the Property Distribution and Off-plan plans.",
      );
    }
    return;
  }

  if (userType === "Landowners") {
    const def = catalogDefinitionByCode(input.planCode);
    if (def?.group === "developer-offplan" || def?.allowsOffPlan) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Off-plan plans are for Developer accounts.",
      );
    }
    if (audience !== SUBSCRIPTION_PLAN_AUDIENCES.DEVELOPER) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Property owner accounts use the Property Distribution plan.",
      );
    }
    return;
  }

  if (PROFESSIONAL_USER_TYPES[userType]) {
    if (audience !== PROFESSIONAL_USER_TYPES[userType]) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        `${userType} accounts can only subscribe to the ${userType} plan.`,
      );
    }
    return;
  }

  if (audience === SUBSCRIPTION_PLAN_AUDIENCES.DEVELOPER) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "Developer plans are only available to Developer accounts.",
    );
  }

  if (
    audience === SUBSCRIPTION_PLAN_AUDIENCES.LAWYER ||
    audience === SUBSCRIPTION_PLAN_AUDIENCES.SURVEYOR ||
    audience === SUBSCRIPTION_PLAN_AUDIENCES.VALUER
  ) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "Service-professional plans are only available to the matching Lawyer, Surveyor, or Valuer account.",
    );
  }

  const scout =
    userType === "PropertyScout" || (await isPropertyScout(String(input.userId)));

  if (scout && audience !== SUBSCRIPTION_PLAN_AUDIENCES.SCOUT) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "Property Scout accounts use the Property Scout plan.",
    );
  }

  if (!scout && audience === SUBSCRIPTION_PLAN_AUDIENCES.SCOUT) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "Property Scout plans are for Property Scouts. Licensed agents use the Licensed Agent Plan.",
    );
  }
}
