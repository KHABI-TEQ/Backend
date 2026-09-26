import { DB } from "../controllers";
import { getPublisherKycStatus, isPublisherKycApproved } from "./publisherKyc.service";

const LEGACY_SCOUT_USER_TYPES = new Set(["Agent", "Developer"]);

export function isStandalonePropertyScout(userType?: string | null): boolean {
  return userType === "PropertyScout";
}

/** Only accounts opened as Property Scout are scouts. Agent/Developer keep their opened role. */
export function isScoutEligibleUserType(userType?: string | null): boolean {
  return isStandalonePropertyScout(userType);
}

export function displayRoleFromUserType(userType?: string | null): string {
  switch (userType) {
    case "PropertyScout":
      return "Property Scout";
    case "Landowners":
      return "Property Owner";
    case "Agent":
      return "Agent";
    case "Developer":
      return "Developer";
    case "Lawyer":
      return "Lawyer";
    case "Surveyor":
      return "Surveyor";
    case "Valuer":
      return "Valuer";
    default:
      return userType || "Account";
  }
}

/** New Property Scout accounts require KYC + listing review. Legacy Agent/Developer scouts do not. */
export function scoutListingsRequireReview(userType?: string | null): boolean {
  return isStandalonePropertyScout(userType);
}

/** Resolve license / registration number from PublisherProfile or legacy Agent KYC. */
export async function resolvePublisherLicenseNumber(
  userId: string
): Promise<string> {
  const [profile, agent] = await Promise.all([
    DB.Models.PublisherProfile.findOne({ userId })
      .select("kycData.licenseOrRegistrationNumber kycStatus")
      .lean(),
    DB.Models.Agent.findOne({ userId })
      .select("kycData.agentLicenseNumber kycStatus")
      .lean(),
  ]);

  const raw =
    profile?.kycData?.licenseOrRegistrationNumber ||
    agent?.kycData?.agentLicenseNumber ||
    "";
  return String(raw).trim();
}

export async function publisherHasLicense(userId: string): Promise<boolean> {
  const license = await resolvePublisherLicenseNumber(userId);
  return license.length > 0;
}

/**
 * Licensed Agent/Developer: approved KYC + non-empty license/registration number.
 */
export async function isLicensedPublisher(userId: string): Promise<boolean> {
  if (!(await isPublisherKycApproved(userId))) return false;
  return publisherHasLicense(userId);
}

/**
 * Property Scout identity is the account they opened — never inferred from KYC.
 */
export async function isPropertyScout(userId: string): Promise<boolean> {
  const user = await DB.Models.User.findById(userId)
    .select("userType isDeleted")
    .lean();
  if (!user || user.isDeleted) return false;
  return isStandalonePropertyScout(user.userType);
}

function kycDisplayLabel(status: string | null): string {
  switch (status) {
    case "pending":
    case "in_review":
      return "KYC UNDER REVIEW";
    case "approved":
      return "KYC VERIFIED";
    case "rejected":
      return "KYC FAILED / REQUIRES ACTION";
    default:
      return "KYC NOT STARTED";
  }
}

export async function getPropertyScoutSnapshot(userId: string): Promise<{
  isPropertyScout: boolean;
  isLicensedPublisher: boolean;
  hasLicense: boolean;
  kycStatus: string | null;
  kycDisplayLabel: string;
  canSubmitOpportunity: boolean;
  listingsRequireReview: boolean;
  isStandalonePropertyScout: boolean;
  pendingProfessionalType: string | null;
  professionalUpgradeStatus: string | null;
  licenseNumberMasked: string | null;
  displayRoleLabel: string;
}> {
  const user = await DB.Models.User.findById(userId)
    .select("userType pendingProfessionalType professionalUpgradeStatus")
    .lean();
  const userType = user?.userType || "";
  const kycStatus = await getPublisherKycStatus(userId);
  const license = await resolvePublisherLicenseNumber(userId);
  const hasLicense = license.length > 0;
  const licensed =
    LEGACY_SCOUT_USER_TYPES.has(userType) &&
    kycStatus === "approved" &&
    hasLicense;
  const standalone = isStandalonePropertyScout(userType);
  const scout = standalone;

  const masked = hasLicense
    ? license.length <= 4
      ? "••••"
      : `${"•".repeat(Math.max(0, license.length - 4))}${license.slice(-4)}`
    : null;

  return {
    isPropertyScout: scout,
    isLicensedPublisher: licensed,
    hasLicense,
    kycStatus,
    kycDisplayLabel: kycDisplayLabel(kycStatus),
    canSubmitOpportunity: standalone ? kycStatus === "approved" : true,
    listingsRequireReview: scoutListingsRequireReview(userType),
    isStandalonePropertyScout: standalone,
    pendingProfessionalType: user?.pendingProfessionalType || null,
    professionalUpgradeStatus: user?.professionalUpgradeStatus || null,
    licenseNumberMasked: masked,
    displayRoleLabel: displayRoleFromUserType(userType),
  };
}
