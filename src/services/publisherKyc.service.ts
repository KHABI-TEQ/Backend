import { Types } from "mongoose";
import { DB } from "../controllers";
import type { PublisherKycStatus, PublisherKycUserType } from "../common/kycTypes";
import { isPublisherKycUserType } from "../common/kycTypes";

export type PublisherKycSubmitPayload = {
  meansOfId: { name: string; docImg: string[] }[];
  address: { street: string; homeNo: string; state: string; localGovtArea: string };
  regionOfOperation: string[];
  practitionerType: "Individual" | "Company";
  agentLicenseNumber?: string;
  licenseOrRegistrationNumber?: string;
  profileBio?: string;
  specializations?: string[];
  languagesSpoken?: string[];
  servicesOffered?: string[];
  achievements?: {
    title: string;
    description?: string;
    fileUrl?: string;
    dateAwarded?: Date | string;
  }[];
  companyDetails?: { companyName?: string; cacNumber?: string };
  kycTier?: "basic" | "advanced";
  advancedKyc?: {
    companyName?: string;
    cacNumber?: string;
    projectName?: string;
    projectLocation?: string;
    projectStage?: string;
    expectedCompletion?: string;
    supportingDocs?: string[];
  };
};

/** Resolve KYC status: PublisherProfile is canonical; Agent collection is legacy fallback. */
export async function getPublisherKycStatus(
  userId: Types.ObjectId | string
): Promise<PublisherKycStatus> {
  const id = new Types.ObjectId(String(userId));
  const profile = await DB.Models.PublisherProfile.findOne({ userId: id }).select("kycStatus").lean();
  if (profile?.kycStatus) {
    return profile.kycStatus as PublisherKycStatus;
  }

  const agent = await DB.Models.Agent.findOne({ userId: id }).select("kycStatus").lean();
  if (agent?.kycStatus) {
    return agent.kycStatus as PublisherKycStatus;
  }

  return "none";
}

export async function ensurePublisherProfile(params: {
  userId: Types.ObjectId | string;
  userType: PublisherKycUserType;
}): Promise<void> {
  const userId = new Types.ObjectId(String(params.userId));
  await DB.Models.PublisherProfile.findOneAndUpdate(
    { userId },
    {
      $setOnInsert: {
        userId,
        userType: params.userType,
        kycStatus: "none",
      },
    },
    { upsert: true, new: true }
  );
}

export function normalizePublisherKycPayload(body: Record<string, unknown>): PublisherKycSubmitPayload {
  const practitionerType = (body.practitionerType || body.agentType) as "Individual" | "Company";
  const license =
    String(body.licenseOrRegistrationNumber || body.agentLicenseNumber || "").trim() || undefined;

  return {
    meansOfId: body.meansOfId as PublisherKycSubmitPayload["meansOfId"],
    address: body.address as PublisherKycSubmitPayload["address"],
    regionOfOperation: body.regionOfOperation as string[],
    practitionerType,
    licenseOrRegistrationNumber: license,
    agentLicenseNumber: license,
    profileBio: body.profileBio ? String(body.profileBio).trim() : undefined,
    specializations: body.specializations as string[] | undefined,
    languagesSpoken: body.languagesSpoken as string[] | undefined,
    servicesOffered: body.servicesOffered as string[] | undefined,
    achievements: body.achievements as PublisherKycSubmitPayload["achievements"],
    companyDetails: body.companyDetails as PublisherKycSubmitPayload["companyDetails"],
    kycTier: body.kycTier === "advanced" ? "advanced" : body.kycTier === "basic" ? "basic" : undefined,
    advancedKyc: body.advancedKyc as PublisherKycSubmitPayload["advancedKyc"],
  };
}

export async function submitPublisherKyc(params: {
  userId: Types.ObjectId | string;
  userType: string;
  payload: PublisherKycSubmitPayload;
}) {
  if (!isPublisherKycUserType(params.userType)) {
    throw new Error("INVALID_USER_TYPE");
  }

  const userId = new Types.ObjectId(String(params.userId));
  const { payload, userType } = params;
  const license = payload.licenseOrRegistrationNumber || payload.agentLicenseNumber;

  const isAdvanced = payload.kycTier === "advanced";
  const isBasicOnly = payload.kycTier === "basic";
  const advanced = payload.advancedKyc || {};
  const companyName =
    payload.companyDetails?.companyName || advanced.companyName || undefined;
  const cacNumber = payload.companyDetails?.cacNumber || advanced.cacNumber || undefined;

  const profileUpdate: Record<string, unknown> = {
    userId,
    userType,
    regionOfOperation: payload.regionOfOperation,
    practitionerType: payload.practitionerType,
    companyDetails:
      payload.practitionerType === "Company" || companyName || cacNumber
        ? { companyName, cacNumber }
        : undefined,
    kycData: {
      licenseOrRegistrationNumber: license,
      profileBio: payload.profileBio,
      specializations: payload.specializations || [],
      languagesSpoken: payload.languagesSpoken || [],
      servicesOffered: payload.servicesOffered || [],
      achievements: (payload.achievements || []).map((a) => ({
        title: a.title,
        description: a.description,
        fileUrl: a.fileUrl,
        dateAwarded: a.dateAwarded ? new Date(a.dateAwarded) : undefined,
      })),
    },
  };

  if (payload.meansOfId?.length) profileUpdate.meansOfId = payload.meansOfId;
  if (payload.address) profileUpdate.address = payload.address;

  if (isBasicOnly) {
    // Establish presence without opening an admin review.
    profileUpdate.kycStatus = "none";
  } else {
    profileUpdate.kycStatus = "pending";
  }

  if (isAdvanced) {
    profileUpdate.advancedKycStatus = "pending";
    profileUpdate.advancedKyc = {
      companyName,
      cacNumber,
      projectName: advanced.projectName,
      projectLocation: advanced.projectLocation,
      projectStage: advanced.projectStage,
      expectedCompletion: advanced.expectedCompletion,
      supportingDocs: advanced.supportingDocs || [],
    };
    profileUpdate.kycStatus = "pending";
  }

  const profile = await DB.Models.PublisherProfile.findOneAndUpdate(
    { userId },
    { $set: profileUpdate },
    { upsert: true, new: true }
  );

  if (userType === "Agent") {
    const agent = await DB.Models.Agent.findOne({ userId });
    if (agent) {
      agent.meansOfId = payload.meansOfId;
      agent.address = payload.address;
      agent.regionOfOperation = payload.regionOfOperation;
      agent.agentType = payload.practitionerType;
      if (payload.practitionerType === "Company" && payload.companyDetails?.companyName) {
        agent.companyAgent = { companyName: payload.companyDetails.companyName };
      }
      if (license) agent.kycData = { ...(agent.kycData || {}), agentLicenseNumber: license };
      if (payload.profileBio) agent.kycData = { ...(agent.kycData || {}), profileBio: payload.profileBio };
      if (payload.specializations) agent.kycData = { ...(agent.kycData || {}), specializations: payload.specializations };
      if (payload.languagesSpoken) agent.kycData = { ...(agent.kycData || {}), languagesSpoken: payload.languagesSpoken };
      if (payload.servicesOffered) agent.kycData = { ...(agent.kycData || {}), servicesOffered: payload.servicesOffered };
      if (payload.achievements?.length) {
        agent.kycData = {
          ...(agent.kycData || {}),
          achievements: payload.achievements.map((a) => ({
            title: a.title,
            description: a.description,
            fileUrl: a.fileUrl,
            dateAwarded: a.dateAwarded ? new Date(a.dateAwarded) : undefined,
          })),
        };
      }
      agent.kycStatus = "pending";
      await agent.save();
    }
  }

  return profile;
}

export async function isPublisherKycApproved(userId: Types.ObjectId | string): Promise<boolean> {
  return (await getPublisherKycStatus(userId)) === "approved";
}
