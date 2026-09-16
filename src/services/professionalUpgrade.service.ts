import { Types } from "mongoose";
import { DB } from "../controllers";
import HttpStatusCodes from "../common/HttpStatusCodes";
import { RouteError } from "../common/classes";
import { isStandalonePropertyScout } from "./propertyScout.service";
import { ensurePublisherProfile } from "./publisherKyc.service";

export const PROFESSIONAL_UPGRADE_TYPES = [
  "Agent",
  "Developer",
  "Lawyer",
  "Surveyor",
  "Valuer",
] as const;

export type ProfessionalUpgradeType = (typeof PROFESSIONAL_UPGRADE_TYPES)[number];

export function isProfessionalUpgradeType(
  value: string | undefined | null
): value is ProfessionalUpgradeType {
  return !!value && (PROFESSIONAL_UPGRADE_TYPES as readonly string[]).includes(value);
}

async function ensureRoleProfile(userId: Types.ObjectId, professionalType: ProfessionalUpgradeType) {
  if (professionalType === "Agent") {
    const existing = await DB.Models.Agent.findOne({ userId });
    if (!existing) {
      await DB.Models.Agent.create({ userId, accountStatus: "inactive", kycStatus: "none" });
    }
    await ensurePublisherProfile({ userId: String(userId), userType: "Agent" });
  }
  if (professionalType === "Developer") {
    await ensurePublisherProfile({ userId: String(userId), userType: "Developer" });
  }
  if (professionalType === "Lawyer") {
    const existing = await DB.Models.LawyerProfile.findOne({ userId });
    if (!existing) {
      await DB.Models.LawyerProfile.create({
        userId,
        verificationFee: 0,
        kycStatus: "none",
        isMarketplaceVisible: false,
      });
    }
  }
  if (professionalType === "Surveyor") {
    const existing = await DB.Models.SurveyorProfile.findOne({ userId });
    if (!existing) {
      await DB.Models.SurveyorProfile.create({
        userId,
        surveyFee: 0,
        kycStatus: "none",
        isMarketplaceVisible: false,
        serviceTypes: ["plan-verification"],
      });
    }
  }
  if (professionalType === "Valuer") {
    const existing = await DB.Models.ValuerProfile.findOne({ userId });
    if (!existing) {
      await DB.Models.ValuerProfile.create({
        userId,
        kycStatus: "none",
        isMarketplaceVisible: false,
      });
    }
  }
}

export async function applyProfessionalUpgrade(params: {
  userId: string;
  professionalType: string;
}) {
  if (!isProfessionalUpgradeType(params.professionalType)) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Select Agent, Developer, Lawyer, Surveyor, or Valuer."
    );
  }

  const user = await DB.Models.User.findById(params.userId);
  if (!user) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "User not found");
  }
  if (!isStandalonePropertyScout(user.userType)) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Only Property Scout accounts can upgrade to a professional role."
    );
  }

  user.pendingProfessionalType = params.professionalType;
  user.professionalUpgradeStatus = "pending";
  await user.save();
  await ensureRoleProfile(user._id as Types.ObjectId, params.professionalType);

  const kycPath =
    params.professionalType === "Agent"
      ? "/agent-kyc"
      : params.professionalType === "Developer"
        ? "/developer-kyc"
        : params.professionalType === "Lawyer"
          ? "/lawyer-kyc"
          : params.professionalType === "Surveyor"
            ? "/surveyor-kyc"
            : "/valuer-kyc";

  return {
    pendingProfessionalType: user.pendingProfessionalType,
    professionalUpgradeStatus: user.professionalUpgradeStatus,
    kycPath,
  };
}

export async function getProfessionalUpgrade(userId: string) {
  const user = await DB.Models.User.findById(userId)
    .select("userType pendingProfessionalType professionalUpgradeStatus")
    .lean();
  return {
    userType: user?.userType || null,
    pendingProfessionalType: user?.pendingProfessionalType || null,
    professionalUpgradeStatus: user?.professionalUpgradeStatus || "none",
    canUpgrade: isStandalonePropertyScout(user?.userType),
  };
}

/** After professional KYC is approved, switch the same account to that role. */
export async function completeProfessionalUpgradeIfPending(
  userId: string,
  approvedType?: ProfessionalUpgradeType
): Promise<boolean> {
  const user = await DB.Models.User.findById(userId);
  if (!user || !isStandalonePropertyScout(user.userType)) return false;
  const nextType = (approvedType || user.pendingProfessionalType) as ProfessionalUpgradeType | undefined;
  if (!isProfessionalUpgradeType(nextType)) return false;

  await ensureRoleProfile(user._id as Types.ObjectId, nextType);
  user.userType = nextType;
  user.professionalUpgradeStatus = "approved";
  user.pendingProfessionalType = undefined;
  user.accountApproved = true;
  user.accountStatus = "active";
  await user.save();

  if (nextType === "Agent" || nextType === "Developer") {
    await DB.Models.PublisherProfile.updateOne(
      { userId: user._id },
      { $set: { userType: nextType } }
    );
  }
  return true;
}
