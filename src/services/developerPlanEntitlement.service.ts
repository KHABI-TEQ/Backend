import { Types } from "mongoose";
import { DB } from "../controllers";
import HttpStatusCodes from "../common/HttpStatusCodes";
import { RouteError } from "../common/classes";
import { UserSubscriptionSnapshotService } from "./userSubscriptionSnapshot.service";
import {
  DEVELOPER_PLAN_PRICING,
  isDeveloperPlanCode,
} from "../common/constants/subscriptionCategories";
import type { PublisherKycStatus } from "../common/kycTypes";

export type DeveloperPlanEntitlement = {
  hasActivePlan: boolean;
  maxProfessionals: number;
  allowsOffPlan: boolean;
  planCode: string | null;
  planName: string | null;
};

const EMPTY_ENTITLEMENT: DeveloperPlanEntitlement = {
  hasActivePlan: false,
  maxProfessionals: 0,
  allowsOffPlan: false,
  planCode: null,
  planName: null,
};

export async function getDeveloperPlanEntitlement(
  userId: string
): Promise<DeveloperPlanEntitlement> {
  const snapshot = await UserSubscriptionSnapshotService.getActiveSnapshot(userId);
  if (!snapshot?.plan) return EMPTY_ENTITLEMENT;

  const plan = await DB.Models.SubscriptionPlan.findById(snapshot.plan)
    .select("name code maxProfessionals allowsOffPlan audience")
    .lean();
  if (!plan) return EMPTY_ENTITLEMENT;

  const code = String(plan.code || "").toUpperCase();
  if (!isDeveloperPlanCode(code) && plan.audience !== "developer") {
    return EMPTY_ENTITLEMENT;
  }

  const maxProfessionals =
    Number(plan.maxProfessionals) > 0
      ? Number(plan.maxProfessionals)
      : code === DEVELOPER_PLAN_PRICING.offPlanAnnualCode
        ? DEVELOPER_PLAN_PRICING.offPlanAnnualProfessionals
        : code === DEVELOPER_PLAN_PRICING.offPlanCode
          ? DEVELOPER_PLAN_PRICING.offPlanProfessionals
          : DEVELOPER_PLAN_PRICING.distributionProfessionals;

  return {
    hasActivePlan: true,
    maxProfessionals,
    allowsOffPlan: Boolean(plan.allowsOffPlan) || code !== DEVELOPER_PLAN_PRICING.distributionCode,
    planCode: code,
    planName: plan.name || null,
  };
}

export async function countAcceptedProfessionals(userId: string): Promise<number> {
  const properties = await DB.Models.Property.find({ owner: userId })
    .select("marketedByAgentIds")
    .lean();
  const ids = new Set<string>();
  for (const property of properties) {
    for (const agentId of property.marketedByAgentIds || []) {
      if (agentId) ids.add(String(agentId));
    }
  }
  return ids.size;
}

export async function assertDeveloperCanAcceptProfessional(
  userId: string,
  incomingAgentId?: string
): Promise<{
  entitlement: DeveloperPlanEntitlement;
  acceptedCount: number;
  remaining: number;
}> {
  const entitlement = await getDeveloperPlanEntitlement(userId);
  const acceptedCount = await countAcceptedProfessionals(userId);
  const remaining = Math.max(0, entitlement.maxProfessionals - acceptedCount);

  if (incomingAgentId) {
    const alreadyAccepted = await DB.Models.Property.exists({
      owner: userId,
      marketedByAgentIds: incomingAgentId,
    });
    if (alreadyAccepted) {
      return { entitlement, acceptedCount, remaining };
    }
  }

  if (!entitlement.hasActivePlan) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "Subscribe to the Developer Property Distribution plan to accept professionals who want to market your properties."
    );
  }

  if (acceptedCount >= entitlement.maxProfessionals) {
    const next =
      entitlement.maxProfessionals <= 10
        ? "Upgrade to the Off-Plan plan to accept up to 30 professionals."
        : entitlement.maxProfessionals <= 30
          ? "Upgrade to the Off-Plan Annual plan to accept up to 100 professionals."
          : "You have reached the professional limit on your current plan.";
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      `You can accept up to ${entitlement.maxProfessionals} professionals on ${entitlement.planName || "your current plan"}. ${next}`
    );
  }

  return { entitlement, acceptedCount, remaining };
}

export async function getDeveloperKycSnapshot(userId: string): Promise<{
  hasBasicProfile: boolean;
  kycStatus: PublisherKycStatus;
  advancedKycStatus: PublisherKycStatus;
  advancedKycApproved: boolean;
}> {
  const profile = await DB.Models.PublisherProfile.findOne({
    userId: new Types.ObjectId(String(userId)),
  })
    .select("practitionerType regionOfOperation kycData kycStatus advancedKycStatus companyDetails")
    .lean();

  const hasBasicProfile = Boolean(
    profile?.practitionerType &&
      ((profile.regionOfOperation && profile.regionOfOperation.length > 0) ||
        profile.kycData?.profileBio ||
        profile.companyDetails?.companyName)
  );

  const kycStatus = (profile?.kycStatus || "none") as PublisherKycStatus;
  const advancedKycStatus = ((profile as { advancedKycStatus?: PublisherKycStatus })
    ?.advancedKycStatus || "none") as PublisherKycStatus;

  return {
    hasBasicProfile,
    kycStatus,
    advancedKycStatus,
    advancedKycApproved: advancedKycStatus === "approved",
  };
}

export const LANDLORD_CANNOT_LIST_OFF_PLAN =
  "Landlords cannot list off-plan properties. Off-plan listings are available to developers only.";

export function isLandlordUserType(userType?: string | null): boolean {
  const t = String(userType || "").trim().toLowerCase();
  return t === "landowners" || t === "landowner" || t === "landlord";
}

export function isOffPlanListingType(propertyType?: string | null): boolean {
  const t = String(propertyType || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  return t === "off-plan" || t === "offplan";
}

export async function assertCanListOffPlanIfRequested(opts: {
  userId: string;
  userType?: string | null;
  propertyType?: string | null;
}): Promise<void> {
  if (!isOffPlanListingType(opts.propertyType)) return;
  if (isLandlordUserType(opts.userType)) {
    throw new RouteError(HttpStatusCodes.FORBIDDEN, LANDLORD_CANNOT_LIST_OFF_PLAN);
  }
  if (String(opts.userType || "").trim().toLowerCase() === "developer") {
    await assertDeveloperCanListOffPlan(opts.userId);
  }
}

export async function assertDeveloperCanListOffPlan(userId: string): Promise<void> {
  const [entitlement, kyc] = await Promise.all([
    getDeveloperPlanEntitlement(userId),
    getDeveloperKycSnapshot(userId),
  ]);

  if (!kyc.advancedKycApproved && !entitlement.allowsOffPlan) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "Off-plan listings require approved Advanced KYC and an active Off-Plan plan. Complete Advanced KYC and subscribe to Off-Plan (₦130,000) or Off-Plan Annual (₦390,000)."
    );
  }
  if (!kyc.advancedKycApproved) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "Complete Advanced KYC and wait for approval before listing off-plan projects."
    );
  }
  if (!entitlement.allowsOffPlan) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "Subscribe to the Off-Plan or Off-Plan Annual plan to list off-plan projects. The Distribution plan covers completed properties only."
    );
  }
}

export async function getDeveloperPlanSnapshot(userId: string) {
  const [entitlement, acceptedCount, kyc, propertyCount] = await Promise.all([
    getDeveloperPlanEntitlement(userId),
    countAcceptedProfessionals(userId),
    getDeveloperKycSnapshot(userId),
    DB.Models.Property.countDocuments({ owner: userId }),
  ]);

  return {
    ...entitlement,
    acceptedCount,
    remainingProfessionals: entitlement.hasActivePlan
      ? Math.max(0, entitlement.maxProfessionals - acceptedCount)
      : 0,
    ...kyc,
    propertyCount,
    canListOffPlan: entitlement.allowsOffPlan && kyc.advancedKycApproved,
  };
}
