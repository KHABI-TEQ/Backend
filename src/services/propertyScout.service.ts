import { DB } from "../controllers";
import { getPublisherKycStatus, isPublisherKycApproved } from "./publisherKyc.service";

const SCOUT_USER_TYPES = new Set(["Agent", "Developer"]);

export function isScoutEligibleUserType(userType?: string | null): boolean {
  return !!userType && SCOUT_USER_TYPES.has(userType);
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
 * Property Scout (dashboard label + inspection rules):
 * Agent or Developer who never submitted KYC, or whose approved KYC has no license.
 * Buyers still see them as Agent/Developer (userType unchanged).
 */
export async function isPropertyScout(userId: string): Promise<boolean> {
  const user = await DB.Models.User.findById(userId)
    .select("userType isDeleted")
    .lean();
  if (!user || user.isDeleted) return false;
  if (!isScoutEligibleUserType(user.userType)) return false;

  const kycStatus = await getPublisherKycStatus(userId);
  const submitted =
    kycStatus === "pending" ||
    kycStatus === "approved" ||
    kycStatus === "rejected";

  if (!submitted) {
    return true;
  }

  if (kycStatus === "approved") {
    return !(await publisherHasLicense(userId));
  }

  // Pending / rejected KYC — not yet a licensed practitioner for inspection accept.
  return true;
}

export async function getPropertyScoutSnapshot(userId: string): Promise<{
  isPropertyScout: boolean;
  isLicensedPublisher: boolean;
  hasLicense: boolean;
  kycStatus: string | null;
  licenseNumberMasked: string | null;
  displayRoleLabel: string;
}> {
  const user = await DB.Models.User.findById(userId).select("userType").lean();
  const userType = user?.userType || "";
  const kycStatus = await getPublisherKycStatus(userId);
  const license = await resolvePublisherLicenseNumber(userId);
  const hasLicense = license.length > 0;
  const licensed =
    isScoutEligibleUserType(userType) &&
    kycStatus === "approved" &&
    hasLicense;
  const scout = isScoutEligibleUserType(userType)
    ? await isPropertyScout(userId)
    : false;

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
    licenseNumberMasked: masked,
    displayRoleLabel: scout
      ? "Property Scout"
      : userType === "Developer"
        ? "Developer"
        : userType === "Agent"
          ? "Agent"
          : userType || "Account",
  };
}
