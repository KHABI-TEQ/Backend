import { Types } from "mongoose";
import { DB } from "../controllers";
import { resolveLeanRefToObjectId } from "../utils/mongooseId";
import { getPublisherKycStatus } from "./publisherKyc.service";

export type PublicAccountKind =
  | "agent"
  | "developer"
  | "scout"
  | "lawyer"
  | "surveyor"
  | "valuer"
  | "other";

export type PublicPractitionerProfile = {
  accountKind: PublicAccountKind;
  displayName: string;
  headline: string;
  photoUrl: string | null;
  coverUrl: string | null;
  shortDescription: string;
  location: string | null;
  areasOfOperation: string[];
  specializations: string[];
  services: string[];
  about: string;
  verification: {
    khabiteqVerified: boolean;
    lasreraStatus: "verified" | "not_applicable" | "not_verified";
    licenseNumber: string | null;
    verificationReference: string | null;
    lastVerifiedAt: string | null;
    professionalRegistration: string | null;
  };
  trust: {
    activeListings: number;
    completedProjects: number | null;
    yearsOnKhabiteq: number;
    inspectionsFacilitated: number;
  };
  capabilities: {
    showProperties: boolean;
    showProjects: boolean;
    showInspection: boolean;
    showServices: boolean;
    showEnquiry: boolean;
  };
};

const HEADLINES: Record<PublicAccountKind, string> = {
  agent: "Licensed Real Estate Practitioner",
  developer: "Property Developer",
  scout: "Property Scout",
  lawyer: "Lawyer",
  surveyor: "Surveyor",
  valuer: "Valuer",
  other: "Real Estate Professional",
};

function kindFromUserType(userType?: string | null): PublicAccountKind {
  switch (String(userType || "").trim().toLowerCase()) {
    case "agent":
      return "agent";
    case "developer":
      return "developer";
    case "propertyscout":
    case "property scout":
    case "scout":
      return "scout";
    case "lawyer":
      return "lawyer";
    case "surveyor":
      return "surveyor";
    case "valuer":
      return "valuer";
    default:
      return "other";
  }
}

function cleanList(values?: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);
}

function publicLocation(parts: Array<string | undefined | null>): string | null {
  const text = parts
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .join(", ");
  return text || null;
}

function verificationReference(userId: string): string {
  const compact = String(userId).replace(/[^a-fA-F0-9]/g, "").slice(-8).toUpperCase();
  return compact ? `KBT-VER-${compact}` : null as unknown as string;
}

function yearsSince(date?: Date | string | null): number {
  if (!date) return 0;
  const start = new Date(date).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / (365.25 * 24 * 60 * 60 * 1000)));
}

const ACTIVE_LISTING_FILTER = {
  isApproved: true,
  isDeleted: { $ne: true },
  isAvailable: { $ne: false },
};

export async function buildPublicPractitionerProfile(params: {
  ownerId: string | Types.ObjectId;
  site?: {
    title?: string;
    description?: string;
    logoUrl?: string;
    about?: any;
    publicPage?: any;
    contactUs?: any;
    status?: string;
    coverUrl?: string;
  };
  professionalKind?: "lawyer" | "surveyor" | "valuer";
}): Promise<PublicPractitionerProfile | null> {
  const ownerId = resolveLeanRefToObjectId(params.ownerId);
  if (!ownerId) return null;

  const user = await DB.Models.User.findById(ownerId)
    .select("firstName lastName fullName profile_picture userType createdAt")
    .lean();
  if (!user) return null;

  const kind = params.professionalKind
    ? params.professionalKind
    : kindFromUserType((user as any).userType);

  const [publisher, agent, lawyer, surveyor, valuer] = await Promise.all([
    DB.Models.PublisherProfile.findOne({ userId: ownerId })
      .select("kycStatus kycApprovedAt kycData regionOfOperation companyDetails practitionerType")
      .lean(),
    kind === "lawyer" || kind === "surveyor" || kind === "valuer"
      ? null
      : DB.Models.Agent.findOne({ userId: ownerId })
          .select("kycStatus kycData updatedAt")
          .lean(),
    kind === "lawyer"
      ? DB.Models.LawyerProfile.findOne({ userId: ownerId })
          .select("firmName profilePhoto bio practiceAreas licenseNumber kycStatus updatedAt")
          .lean()
      : null,
    kind === "surveyor"
      ? DB.Models.SurveyorProfile.findOne({ userId: ownerId })
          .select("firmName profilePhoto bio serviceTypes licenseNumber kycStatus updatedAt")
          .lean()
      : null,
    kind === "valuer"
      ? DB.Models.ValuerProfile.findOne({ userId: ownerId })
          .select("firmName profilePhoto bio licenseNumber kycStatus updatedAt")
          .lean()
      : null,
  ]);

  const publisherKyc =
    kind === "lawyer"
      ? lawyer?.kycStatus
      : kind === "surveyor"
        ? surveyor?.kycStatus
        : kind === "valuer"
          ? valuer?.kycStatus
          : await getPublisherKycStatus(ownerId);

  const kycApproved = publisherKyc === "approved";
  const khabiteqVerified = Boolean(kycApproved);

  const licenseNumber = khabiteqVerified
    ? String(
        lawyer?.licenseNumber ||
          surveyor?.licenseNumber ||
          valuer?.licenseNumber ||
          publisher?.kycData?.licenseOrRegistrationNumber ||
          (agent as any)?.kycData?.agentLicenseNumber ||
          ""
      ).trim() || null
    : null;

  const lasreraStatus: PublicPractitionerProfile["verification"]["lasreraStatus"] =
    kind === "agent" || kind === "developer" || kind === "scout"
      ? licenseNumber
        ? "verified"
        : kycApproved
          ? "not_verified"
          : "not_verified"
      : "not_applicable";

  const lastVerifiedAt =
    publisher?.kycApprovedAt ||
    (kycApproved
      ? lawyer?.updatedAt || surveyor?.updatedAt || valuer?.updatedAt || (agent as any)?.updatedAt
      : null);

  const displayName =
    String(params.site?.title || "").trim() ||
    String(lawyer?.firmName || surveyor?.firmName || valuer?.firmName || publisher?.companyDetails?.companyName || "").trim() ||
    String((user as any).fullName || "").trim() ||
    [`${(user as any).firstName || ""}`, `${(user as any).lastName || ""}`].join(" ").trim() ||
    HEADLINES[kind];

  const about =
    String(params.site?.about?.whoWeAre?.description || "").trim() ||
    String(params.site?.description || "").trim() ||
    String(publisher?.kycData?.profileBio || lawyer?.bio || surveyor?.bio || valuer?.bio || "").trim();

  const plainAbout = about.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
  const shortDescription =
    String(params.site?.publicPage?.heroSubtitle || params.site?.publicPage?.heroDescription || "").trim() ||
    plainAbout.slice(0, 180);

  const areas = cleanList([
    ...(publisher?.regionOfOperation || []),
    ...((params.site?.about?.whereWeOperate?.locations || []).map((l: any) => l?.name || l?.address) || []),
    params.site?.contactUs?.location?.name,
  ]);

  const location =
    publicLocation([params.site?.contactUs?.location?.name, areas[0], "Nigeria"]) ||
    (areas[0] ? `${areas[0]}, Nigeria` : "Nigeria");

  const servicesFromAbout = (params.site?.about?.whatWeDo?.items || []).map((i: any) => i?.title);
  const services = cleanList([
    ...(publisher?.kycData?.servicesOffered || []),
    ...(lawyer?.practiceAreas || []),
    ...(surveyor?.serviceTypes || []).map((s) =>
      s === "plan-verification" ? "Plan verification" : s === "site-survey" ? "Site survey" : s
    ),
    ...servicesFromAbout,
  ]);

  const specializations = cleanList(publisher?.kycData?.specializations);

  const photoUrl =
    params.site?.logoUrl ||
    lawyer?.profilePhoto ||
    surveyor?.profilePhoto ||
    valuer?.profilePhoto ||
    (user as any).profile_picture ||
    null;

  const coverUrl =
    params.site?.coverUrl ||
    params.site?.publicPage?.heroImageUrl ||
    params.site?.publicPage?.heroImage ||
    null;

  const listingOwnerFilter = {
    $or: [
      { owner: ownerId },
      { marketedByAgentIds: ownerId },
      { marketedByAgentId: ownerId },
    ],
  };

  const showProperties = kind === "agent" || kind === "developer" || kind === "scout";
  const [activeListings, inspectionsFacilitated, completedProjects] = await Promise.all([
    showProperties
      ? DB.Models.Property.countDocuments({ ...listingOwnerFilter, ...ACTIVE_LISTING_FILTER })
      : Promise.resolve(0),
    DB.Models.InspectionBooking.countDocuments({
      $or: [{ owner: ownerId }, { requestedBy: ownerId }],
      status: { $in: ["completed", "inspection_approved", "negotiation_accepted"] },
    }),
    kind === "developer"
      ? DB.Models.Property.countDocuments({
          owner: ownerId,
          isDeleted: { $ne: true },
          $or: [{ isAvailable: false }, { briefType: /completed|sold/i }],
        })
      : Promise.resolve(null),
  ]);

  return {
    accountKind: kind,
    displayName,
    headline: HEADLINES[kind],
    photoUrl,
    coverUrl,
    shortDescription,
    location,
    areasOfOperation: areas,
    specializations,
    services,
    about,
    verification: {
      khabiteqVerified,
      lasreraStatus,
      licenseNumber,
      verificationReference: khabiteqVerified ? verificationReference(String(ownerId)) : null,
      lastVerifiedAt: lastVerifiedAt ? new Date(lastVerifiedAt).toISOString() : null,
      professionalRegistration:
        kind === "lawyer" || kind === "surveyor" || kind === "valuer"
          ? kycApproved
            ? "Approved"
            : "Not verified"
          : null,
    },
    trust: {
      activeListings,
      completedProjects: kind === "developer" ? Number(completedProjects || 0) : null,
      yearsOnKhabiteq: yearsSince((user as any).createdAt),
      inspectionsFacilitated: Number(inspectionsFacilitated || 0),
    },
    capabilities: {
      showProperties,
      showProjects: kind === "developer",
      showInspection: showProperties && activeListings > 0,
      showServices: services.length > 0 || kind === "lawyer" || kind === "surveyor" || kind === "valuer",
      showEnquiry: true,
    },
  };
}
