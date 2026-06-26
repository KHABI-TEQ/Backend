import { DB } from "../controllers";
import { getFeeSummaryLines } from "../config/channelAccess.config";
import { maskPhoneForDisplay, normalizeNigerianPhone, phoneVariantsForLookup } from "../common/phoneUtils";

export interface AgentVerificationResult {
  found: boolean;
  verified: boolean;
  agentName?: string;
  licenseNumber?: string;
  summary: string;
}

export interface PropertyVerificationResult {
  found: boolean;
  summary: string;
  matches: Array<{
    address: string | null;
    status: string;
    registrationStatus: string;
  }>;
}

export async function verifyAgentByPhone(phone: string): Promise<AgentVerificationResult> {
  const variants = phoneVariantsForLookup(phone);
  if (!variants.length) {
    return {
      found: false,
      verified: false,
      summary: "Invalid phone number. Use format 08031234567.",
    };
  }

  const user = await DB.Models.User.findOne({
    userType: "Agent",
    isDeleted: { $ne: true },
    phoneNumber: { $in: variants },
  })
    .select("firstName lastName fullName phoneNumber accountApproved isAccountVerified")
    .lean();

  if (!user) {
    return {
      found: false,
      verified: false,
      summary: "No agent found with this phone number.",
    };
  }

  const profile = await DB.Models.PublisherProfile.findOne({ userId: user._id })
    .select("kycStatus kycData.licenseOrRegistrationNumber")
    .lean();

  const agent = await DB.Models.Agent.findOne({ userId: user._id })
    .select("kycStatus kycData.agentLicenseNumber")
    .lean();

  const kycApproved =
    profile?.kycStatus === "approved" || agent?.kycStatus === "approved";
  const name =
    user.fullName?.trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    "Agent";
  const license =
    profile?.kycData?.licenseOrRegistrationNumber ||
    agent?.kycData?.agentLicenseNumber ||
    null;

  if (!kycApproved) {
    return {
      found: true,
      verified: false,
      agentName: name,
      licenseNumber: license || undefined,
      summary: `${name} is registered but NOT yet LASRERA-verified.`,
    };
  }

  const licenseLine = license ? ` License: ${license}.` : "";
  return {
    found: true,
    verified: true,
    agentName: name,
    licenseNumber: license || undefined,
    summary: `${name} is VERIFIED on LASRERA-KHABITEQ.${licenseLine}`,
  };
}

export async function verifyPropertyByKeyword(keyword: string): Promise<PropertyVerificationResult> {
  const term = String(keyword || "").trim();
  if (term.length < 3) {
    return {
      found: false,
      summary: "Enter at least 3 characters of the address.",
      matches: [],
    };
  }

  const registrations = await DB.Models.TransactionRegistration.find({
    "propertyIdentification.exactAddress": new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
  })
    .select("status propertyIdentification.exactAddress")
    .limit(3)
    .lean();

  if (!registrations.length) {
    return {
      found: false,
      summary: "No registered transaction found for that address.",
      matches: [],
    };
  }

  const matches = registrations.map((r: any) => {
    const registrationStatus =
      r.status === "completed"
        ? "Registered"
        : r.status === "submitted" || r.status === "pending_completion"
          ? "Pending"
          : String(r.status);
    return {
      address: r.propertyIdentification?.exactAddress ?? null,
      status: String(r.status),
      registrationStatus,
    };
  });

  const first = matches[0];
  const extra = matches.length > 1 ? ` (+${matches.length - 1} more)` : "";
  return {
    found: true,
    summary: `Property: ${first.registrationStatus}.${extra}`,
    matches,
  };
}

export function getRegistrationFeeSummaryText(): string {
  return getFeeSummaryLines().join(" ");
}

export function buildSmsReceiptBody(kind: "agent" | "property", detail: string, phone: string): string {
  const masked = maskPhoneForDisplay(phone);
  const prefix =
    kind === "agent"
      ? "LASRERA-KHABITEQ Agent Check"
      : "LASRERA-KHABITEQ Property Check";
  return `${prefix} (${masked}): ${detail}`;
}

export function normalizeChannelPhone(phone: string): string | null {
  return normalizeNigerianPhone(phone);
}
