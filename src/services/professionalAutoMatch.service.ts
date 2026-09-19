import { Types } from "mongoose";
import { DB } from "../controllers";
import { notifyAllActiveAdmins } from "./adminNotification.service";
import { notifyProfessionalOfNewRequest } from "./professionalRequest.service";
import notificationService from "./notification.service";
import type { IProfessionalServiceRequestDoc } from "../models/professionalServiceRequest";

export const OPEN_JOB_CAP = 5;
const OPEN_JOB_STATUSES = ["awaiting-acceptance", "in-progress"];
const UNCLAIMED_AFTER_MS = 24 * 60 * 60 * 1000;

export type MatchCategory = "lawyer" | "surveyor" | "valuer";

export type EligibleProfessional = {
  userId: Types.ObjectId;
  email?: string;
  name: string;
};

function expectedUserType(category: MatchCategory): "Lawyer" | "Surveyor" | "Valuer" {
  if (category === "lawyer") return "Lawyer";
  if (category === "surveyor") return "Surveyor";
  return "Valuer";
}

export function surveyorJobTypeForSlug(
  slug: string
): "plan-verification" | "site-survey" {
  if (slug === "land-survey" || slug === "boundary-survey") {
    return "site-survey";
  }
  return "plan-verification";
}

function isUsableAccount(user: {
  isInActive?: boolean;
  isDeleted?: boolean;
  isFlagged?: boolean;
  accountStatus?: string;
  userType?: string;
}): boolean {
  if (!user) return false;
  if (user.isInActive || user.isDeleted || user.isFlagged) return false;
  const status = String(user.accountStatus || "active");
  if (["inactive", "deleted", "flagged", "pending_deletion"].includes(status)) {
    return false;
  }
  return true;
}

async function usersAtCapacity(
  userIds: Types.ObjectId[]
): Promise<Set<string>> {
  if (!userIds.length) return new Set();

  const [dvs, srs, psrs] = await Promise.all([
    DB.Models.DocumentVerification.aggregate([
      {
        $match: {
          lawyerId: { $in: userIds },
          status: { $in: OPEN_JOB_STATUSES },
        },
      },
      { $group: { _id: "$lawyerId", n: { $sum: 1 } } },
    ]),
    DB.Models.SurveyRequest.aggregate([
      {
        $match: {
          surveyorId: { $in: userIds },
          status: { $in: OPEN_JOB_STATUSES },
        },
      },
      { $group: { _id: "$surveyorId", n: { $sum: 1 } } },
    ]),
    DB.Models.ProfessionalServiceRequest.aggregate([
      {
        $match: {
          professionalId: { $in: userIds },
          status: { $in: OPEN_JOB_STATUSES },
        },
      },
      { $group: { _id: "$professionalId", n: { $sum: 1 } } },
    ]),
  ]);

  const counts = new Map<string, number>();
  for (const row of [...dvs, ...srs, ...psrs] as { _id: Types.ObjectId; n: number }[]) {
    const key = String(row._id);
    counts.set(key, (counts.get(key) || 0) + Number(row.n || 0));
  }

  const over = new Set<string>();
  for (const [id, n] of counts) {
    if (n >= OPEN_JOB_CAP) over.add(id);
  }
  return over;
}

export async function findEligibleProfessionals(
  category: MatchCategory,
  serviceSlug: string
): Promise<EligibleProfessional[]> {
  const userType = expectedUserType(category);
  const profileFilter: Record<string, unknown> = {
    kycStatus: "approved",
    isMarketplaceVisible: true,
  };
  if (category === "surveyor") {
    profileFilter.serviceTypes = surveyorJobTypeForSlug(serviceSlug);
  }

  const profiles =
    category === "lawyer"
      ? await DB.Models.LawyerProfile.find(profileFilter).lean()
      : category === "surveyor"
        ? await DB.Models.SurveyorProfile.find(profileFilter).lean()
        : await DB.Models.ValuerProfile.find(profileFilter).lean();
  if (!profiles.length) return [];

  const profileUserIds = profiles.map((p) => p.userId);
  const users = await DB.Models.User.find({
    _id: { $in: profileUserIds },
    userType,
  }).lean();
  const userById = new Map(users.map((u) => [String(u._id), u]));
  const atCapacity = await usersAtCapacity(profileUserIds);

  const eligible: EligibleProfessional[] = [];
  for (const profile of profiles) {
    const user = userById.get(String(profile.userId));
    if (!user || user.userType !== userType) continue;
    if (!isUsableAccount(user)) continue;
    if (category !== "valuer" && !(profile as { paystackSubaccountCode?: string }).paystackSubaccountCode) {
      continue;
    }
    if (atCapacity.has(String(user._id))) continue;
    eligible.push({
      userId: user._id as Types.ObjectId,
      email: user.email,
      name:
        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
        (category === "lawyer"
          ? "Lawyer"
          : category === "surveyor"
            ? "Surveyor"
            : "Valuer"),
    });
  }
  return eligible;
}

export async function isProfessionalEligibleForRequest(params: {
  userId: string;
  category: MatchCategory;
  serviceSlug: string;
}): Promise<boolean> {
  const pool = await findEligibleProfessionals(params.category, params.serviceSlug);
  return pool.some((p) => String(p.userId) === String(params.userId));
}

function requestSummary(request: IProfessionalServiceRequestDoc): string {
  const answers = (request.answers || {}) as Record<string, unknown>;
  const location = String(answers.propertyAddress || "").trim();
  const locBit = location ? ` Location: ${location}.` : "";
  return `${request.serviceName}.${locBit} Fee: ₦${Number(request.customerPrice || 0).toLocaleString()}.`;
}

export async function broadcastNewServiceRequest(
  request: IProfessionalServiceRequestDoc
): Promise<EligibleProfessional[]> {
  const eligible = await findEligibleProfessionals(
    request.category,
    request.slug
  );
  const offeredTo = eligible.map((p) => p.userId);

  request.offeredTo = offeredTo;
  request.broadcastAt = new Date();
  await request.save();

  const summary = requestSummary(request);
  await Promise.all(
    eligible.map((pro) =>
      notifyProfessionalOfNewRequest({
        kind: request.category,
        professionalUserId: String(pro.userId),
        professionalEmail: pro.email,
        professionalName: pro.name,
        referenceCode: request.reference,
        jobId: String(request._id),
        summary,
        serviceName: request.serviceName,
        broadcast: true,
      })
    )
  );

  return eligible;
}

export async function notifyRequestTaken(params: {
  request: IProfessionalServiceRequestDoc;
  winnerId: string;
}): Promise<void> {
  const others = (params.request.offeredTo || []).filter(
    (id) => String(id) !== String(params.winnerId)
  );
  await Promise.all(
    others.map((userId) =>
      notificationService.createNotification({
        user: String(userId),
        title: "Request taken",
        message: `This ${params.request.serviceName} request has been accepted by another professional.`,
        type: "general",
        meta: {
          catalogRequestId: String(params.request._id),
          referenceCode: params.request.reference,
          taken: true,
        },
      })
    )
  );
}

export async function flagUnclaimedCatalogRequests(): Promise<void> {
  const cutoff = new Date(Date.now() - UNCLAIMED_AFTER_MS);
  const stale = await DB.Models.ProfessionalServiceRequest.find({
    status: "awaiting-acceptance",
    unclaimedAdminNotified: { $ne: true },
    broadcastAt: { $lte: cutoff },
    $or: [{ professionalId: null }, { professionalId: { $exists: false } }],
  });

  for (const request of stale) {
    request.unclaimedAdminNotified = true;
    await request.save();
    void notifyAllActiveAdmins({
      type: "general",
      title: "Unclaimed professional service request",
      message: `${request.serviceName} (${request.reference}) has had no accept for 24 hours.`,
      meta: {
        reference: request.reference,
        requestId: String(request._id),
        slug: request.slug,
        category: request.category,
      },
    });
    try {
      await broadcastNewServiceRequest(request);
    } catch (err) {
      console.warn("[AutoMatch] re-broadcast of unclaimed request failed:", err);
    }
  }
}
