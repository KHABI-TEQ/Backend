import { Types } from "mongoose";
import { DB } from "../controllers";
import { isPublisherKycApproved } from "./publisherKyc.service";

export type PublicLicensedAgentCard = {
  _id: string;
  firstName: string;
  lastName: string;
  profile_picture?: string;
  profileBio?: string;
  specializations?: string[];
  languagesSpoken?: string[];
  servicesOffered?: string[];
  regionOfOperation?: string[];
  practitionerType?: string;
  companyName?: string;
  publicSlug?: string | null;
  userType: "Agent" | "Developer";
  /** Approved KYC + non-empty license. Buyers still see everyone as practitioners. */
  isLicensed?: boolean;
  /**
   * True only when the practitioner has a running public DealSite.
   * Paused (e.g. inactive subscription) or missing page → false ("Unreachable for now").
   */
  isPageReachable?: boolean;
};

function projectPublicCard(row: any): PublicLicensedAgentCard {
  const kyc = row.publisherProfile?.kycData || row.agentProfile?.kycData || {};
  const company =
    kyc.companyDetails?.companyName ||
    row.publisherProfile?.kycData?.companyDetails?.companyName ||
    undefined;
  const licenseNumber = String(row.licenseNumber || "").trim();
  const isLicensed =
    row.resolvedKycStatus === "approved" && licenseNumber.length > 0;
  const dealStatus = String(row.dealSite?.status || "");
  const publicSlug = row.dealSite?.publicSlug
    ? String(row.dealSite.publicSlug)
    : null;
  return {
    _id: String(row._id),
    firstName: row.firstName || "",
    lastName: row.lastName || "",
    profile_picture: row.profile_picture || undefined,
    profileBio: kyc.profileBio || undefined,
    specializations: kyc.specializations || undefined,
    languagesSpoken: kyc.languagesSpoken || undefined,
    servicesOffered: kyc.servicesOffered || undefined,
    regionOfOperation:
      row.publisherProfile?.regionOfOperation ||
      row.agentProfile?.regionOfOperation ||
      undefined,
    practitionerType: kyc.practitionerType || kyc.agentType || undefined,
    companyName: company,
    publicSlug,
    userType: row.userType === "Developer" ? "Developer" : "Agent",
    isLicensed,
    isPageReachable: !!publicSlug && dealStatus === "running",
  };
}

/**
 * Agents/Developers for directories.
 * - requireLicense true (default): approved KYC + non-empty license (licensed Agents).
 * - requireLicense false + requireKycApproved true: KYC-approved practitioners
 *   (licensed or not / property scouts with approved KYC).
 * Public-safe projection — no email/phone/whatsapp.
 */
export async function listLicensedPublishers(params: {
  state?: string;
  localGovernment?: string;
  search?: string;
  page?: number;
  limit?: number;
  userTypes?: Array<"Agent" | "Developer">;
  /** Default true. Set false for buyer practitioner directory. */
  requireLicense?: boolean;
  /** When requireLicense is false, still require approved KYC (buyer directory). */
  requireKycApproved?: boolean;
}): Promise<{ data: PublicLicensedAgentCard[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;
  const requireLicense = params.requireLicense !== false;
  const requireKycApproved = params.requireKycApproved === true;
  const userTypes = params.userTypes?.length
    ? params.userTypes
    : (["Agent"] as Array<"Agent" | "Developer">);

  const userFilter: Record<string, unknown> = {
    userType: { $in: userTypes },
    isDeleted: { $ne: true },
    isInActive: { $ne: true },
    accountApproved: true,
  };

  if (params.search?.trim()) {
    const q = params.search.trim();
    const or: Record<string, unknown>[] = [
      { firstName: new RegExp(q, "i") },
      { lastName: new RegExp(q, "i") },
      { fullName: new RegExp(q, "i") },
    ];

    // Allow searching by public page slug (e.g. "realhomes"), including paused pages
    const slugGuess = q
      .toLowerCase()
      .replace(/^https?:\/\//i, "")
      .split(/[/?#]/)[0]
      .split(".")[0]
      .replace(/[^a-z0-9-]/g, "");
    if (slugGuess.length >= 2) {
      const site = await DB.Models.DealSite.findOne({
        publicSlug: slugGuess,
        status: { $in: ["running", "paused"] },
        isDeleted: { $ne: true },
      })
        .select("createdBy")
        .lean();
      if (site?.createdBy) {
        or.push({ _id: site.createdBy });
      }
    }

    userFilter.$or = or;
  }

  const pipeline: any[] = [
    { $match: userFilter },
    {
      $lookup: {
        from: "publisherprofiles",
        localField: "_id",
        foreignField: "userId",
        as: "publisherProfile",
      },
    },
    {
      $unwind: {
        path: "$publisherProfile",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "agents",
        localField: "_id",
        foreignField: "userId",
        as: "agentProfile",
      },
    },
    {
      $unwind: {
        path: "$agentProfile",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $addFields: {
        licenseNumber: {
          $trim: {
            input: {
              $ifNull: [
                "$publisherProfile.kycData.licenseOrRegistrationNumber",
                {
                  $ifNull: ["$agentProfile.kycData.agentLicenseNumber", ""],
                },
              ],
            },
          },
        },
        resolvedKycStatus: {
          $ifNull: [
            "$publisherProfile.kycStatus",
            { $ifNull: ["$agentProfile.kycStatus", "none"] },
          ],
        },
      },
    },
  ];

  if (requireLicense) {
    pipeline.push({
      $match: {
        resolvedKycStatus: "approved",
        licenseNumber: { $ne: "" },
      },
    });
  } else if (requireKycApproved) {
    pipeline.push({
      $match: {
        resolvedKycStatus: "approved",
      },
    });
  }

  if (params.localGovernment?.trim()) {
    const lga = params.localGovernment.trim();
    pipeline.push({
      $match: {
        $or: [
          {
            "publisherProfile.regionOfOperation": new RegExp(lga, "i"),
          },
          { "agentProfile.regionOfOperation": new RegExp(lga, "i") },
        ],
      },
    });
  } else if (params.state?.trim()) {
    const state = params.state.trim();
    pipeline.push({
      $match: {
        $or: [
          {
            "publisherProfile.regionOfOperation": new RegExp(state, "i"),
          },
          { "agentProfile.regionOfOperation": new RegExp(state, "i") },
        ],
      },
    });
  }

  pipeline.push(
    {
      $lookup: {
        from: "dealsites",
        let: { uid: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$createdBy", "$$uid"] },
              // Include paused (e.g. inactive subscription) so buyers still see the practitioner
              status: { $in: ["running", "paused"] },
              isDeleted: { $ne: true },
            },
          },
          {
            $addFields: {
              statusRank: {
                $cond: [{ $eq: ["$status", "running"] }, 0, 1],
              },
            },
          },
          { $sort: { statusRank: 1, updatedAt: -1 } },
          { $project: { publicSlug: 1, status: 1, pausedByPolicy: 1 } },
          { $limit: 1 },
        ],
        as: "dealSiteArr",
      },
    },
    {
      $addFields: {
        dealSite: { $arrayElemAt: ["$dealSiteArr", 0] },
      },
    },
    { $sort: { firstName: 1, lastName: 1 } },
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: "count" }],
      },
    }
  );

  const agg = await DB.Models.User.aggregate(pipeline);
  const rows = agg[0]?.data ?? [];
  const total = agg[0]?.total?.[0]?.count ?? 0;

  // Extra safety filter for edge KYC mirror lag
  const data: PublicLicensedAgentCard[] = rows.map(projectPublicCard);

  return { data, total, page, limit };
}

export async function assertUserIsLicensedAgent(
  userId: string | Types.ObjectId
): Promise<void> {
  const user = await DB.Models.User.findById(userId)
    .select("userType isDeleted isInActive accountApproved")
    .lean();
  if (
    !user ||
    user.isDeleted ||
    user.isInActive ||
    user.userType !== "Agent" ||
    !user.accountApproved
  ) {
    throw new Error("Licensed agent not found");
  }
  if (!(await isPublisherKycApproved(String(userId)))) {
    throw new Error("Licensed agent not found");
  }
  const profile = await DB.Models.PublisherProfile.findOne({ userId })
    .select("kycData.licenseOrRegistrationNumber")
    .lean();
  const agent = await DB.Models.Agent.findOne({ userId })
    .select("kycData.agentLicenseNumber")
    .lean();
  const license = String(
    profile?.kycData?.licenseOrRegistrationNumber ||
      agent?.kycData?.agentLicenseNumber ||
      ""
  ).trim();
  if (!license) {
    throw new Error("Licensed agent not found");
  }
}
