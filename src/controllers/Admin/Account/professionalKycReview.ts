import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import sendEmail from "../../../common/send.email";
import { provisionProfessionalSiteOnKycApprove } from "../../../services/professionalSite.service";
import { completeProfessionalUpgradeIfPending } from "../../../services/professionalUpgrade.service";
import { syncPractitionerPageEligibility } from "../../../services/agentPublisherEligibility.service";

type Kind = "Lawyer" | "Surveyor" | "Valuer";

const USER_SELECT =
  "firstName lastName email phoneNumber accountId accountApproved accountStatus profile_picture createdAt isAccountVerified userType isInActive isFlagged isDeleted pendingProfessionalType";

function profileModel(kind: Kind): mongoose.Model<any> {
  if (kind === "Lawyer") return DB.Models.LawyerProfile;
  if (kind === "Surveyor") return DB.Models.SurveyorProfile;
  return DB.Models.ValuerProfile;
}

async function findProfessionalProfile(kind: Kind, userId: string) {
  return profileModel(kind).findOne({ userId }).lean();
}

async function findOrCreateProfessionalProfile(kind: Kind, userId: mongoose.Types.ObjectId) {
  const Model = profileModel(kind);
  let profile = await Model.findOne({ userId });
  if (!profile) {
    profile = await Model.create({ userId, kycStatus: "pending" });
  }
  return profile;
}

async function reviewProfessional(
  kind: Kind,
  userId: string,
  response: "approve" | "reject",
  note?: string
) {
  const user = await DB.Models.User.findById(userId);
  const pending = user?.pendingProfessionalType;
  const isUpgrade =
    user?.userType === "PropertyScout" && pending === kind;
  if (!user || (user.userType !== kind && !isUpgrade)) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, `${kind} account not found.`);
  }

  const profile = await findOrCreateProfessionalProfile(kind, user._id as mongoose.Types.ObjectId);

  const approved = response === "approve";
  profile.kycStatus = approved ? "approved" : "rejected";
  profile.isMarketplaceVisible = approved;
  if (note?.trim()) profile.kycNote = note.trim();
  await profile.save();

  user.accountApproved = approved;
  if (approved) {
    user.accountStatus = "active";
    user.isDeleted = false;
  }
  await user.save();

  if (approved) {
    await completeProfessionalUpgradeIfPending(String(user._id), kind);
  }

  await syncPractitionerPageEligibility(String(user._id));

  let professionalSite = null;
  if (approved && kind !== "Valuer") {
    professionalSite = await provisionProfessionalSiteOnKycApprove({
      kind: kind === "Lawyer" ? "lawyer" : "surveyor",
      ownerId: String(user._id),
      firstName: user.firstName,
      lastName: user.lastName,
      firmName: profile.firmName,
      logoUrl: profile.profilePhoto || user.profile_picture,
      about: profile.bio,
    });
  }

  if (user.email) {
    await sendEmail({
      to: user.email,
      subject: approved
        ? `Your ${kind.toLowerCase()} account is activated`
        : `Your ${kind.toLowerCase()} KYC was rejected`,
      text: approved
        ? `Congratulations ${user.firstName}. Your ${kind.toLowerCase()} profile is approved and now visible on the Khabi-Teq marketplace. Set up your personal public page in the Practitioners app when you are ready.`
        : `Hello ${user.firstName}. Your ${kind.toLowerCase()} KYC was rejected. ${note || "Please update your documents and resubmit."}`,
    });
  }

  return { user, profile, professionalSite };
}

export const reviewLawyerKyc = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { response, note } = req.body as {
      response: "approve" | "reject";
      note?: string;
    };
    if (!["approve", "reject"].includes(response)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Response must be approve or reject."
      );
    }
    const data = await reviewProfessional("Lawyer", req.params.userId, response, note);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: `Lawyer KYC ${response}d.`,
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const reviewSurveyorKyc = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { response, note } = req.body as {
      response: "approve" | "reject";
      note?: string;
    };
    if (!["approve", "reject"].includes(response)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Response must be approve or reject."
      );
    }
    const data = await reviewProfessional(
      "Surveyor",
      req.params.userId,
      response,
      note
    );
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: `Surveyor KYC ${response}d.`,
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const listPendingLawyers = async (
  _req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const profiles = await DB.Models.LawyerProfile.find({
      kycStatus: { $in: ["pending", "in_review", "none"] },
    })
      .populate("userId", USER_SELECT)
      .sort({ updatedAt: -1 })
      .lean();
    return res.status(HttpStatusCodes.OK).json({ success: true, data: profiles });
  } catch (err) {
    next(err);
  }
};

export const listPendingSurveyors = async (
  _req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const profiles = await DB.Models.SurveyorProfile.find({
      kycStatus: { $in: ["pending", "in_review", "none"] },
    })
      .populate("userId", USER_SELECT)
      .sort({ updatedAt: -1 })
      .lean();
    return res.status(HttpStatusCodes.OK).json({ success: true, data: profiles });
  } catch (err) {
    next(err);
  }
};

export const listPendingValuers = async (
  _req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const profiles = await DB.Models.ValuerProfile.find({
      kycStatus: { $in: ["pending", "in_review", "none"] },
    })
      .populate("userId", USER_SELECT)
      .sort({ updatedAt: -1 })
      .lean();
    return res.status(HttpStatusCodes.OK).json({ success: true, data: profiles });
  } catch (err) {
    next(err);
  }
};

async function getProfessionalKycPayload(kind: Kind, userId: string) {
  const user = await DB.Models.User.findById(userId).select(USER_SELECT).lean();
  if (!user) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, `${kind} account not found.`);
  }
  const profile = await findProfessionalProfile(kind, userId);
  if (!profile) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, `${kind} profile not found.`);
  }
  return { user, profile };
}

export const getLawyerKyc = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await getProfessionalKycPayload("Lawyer", req.params.userId);
    return res.status(HttpStatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getSurveyorKyc = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await getProfessionalKycPayload("Surveyor", req.params.userId);
    return res.status(HttpStatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getValuerKyc = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await getProfessionalKycPayload("Valuer", req.params.userId);
    return res.status(HttpStatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const listPendingDevelopers = async (
  _req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const profiles = await DB.Models.PublisherProfile.find({
      userType: "Developer",
      $or: [
        { kycStatus: { $in: ["pending", "in_review"] } },
        { advancedKycStatus: { $in: ["pending", "in_review"] } },
      ],
    })
      .populate("userId", USER_SELECT)
      .sort({ updatedAt: -1 })
      .lean();
    return res.status(HttpStatusCodes.OK).json({ success: true, data: profiles });
  } catch (err) {
    next(err);
  }
};

export const getDeveloperKyc = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await DB.Models.User.findById(req.params.userId)
      .select(USER_SELECT)
      .lean();
    if (!user) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Developer account not found.");
    }
    const profile = await DB.Models.PublisherProfile.findOne({
      userId: user._id,
      userType: "Developer",
    }).lean();
    if (!profile) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Developer KYC profile not found.");
    }
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: { user, profile },
    });
  } catch (err) {
    next(err);
  }
};

export const reviewValuerKyc = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { response, note } = req.body as {
      response: "approve" | "reject";
      note?: string;
    };
    if (!["approve", "reject"].includes(response)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Response must be approve or reject."
      );
    }
    const data = await reviewProfessional("Valuer", req.params.userId, response, note);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: `Valuer KYC ${response}d.`,
      data,
    });
  } catch (err) {
    next(err);
  }
};

const ALLOWED_SORT_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "email",
  "firstName",
  "lastName",
  "accountStatus",
  "accountApproved",
  "isAccountVerified",
]);

async function listAllProfessionals(kind: Kind, req: AppRequest, res: Response) {
  const safePage = Math.max(1, Number(req.query.page) || 1);
  const safeLimit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
  const skip = (safePage - 1) * safeLimit;
  const {
    search,
    excludeInactive,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  const query: Record<string, unknown> = {
    isDeleted: { $ne: true },
    $or: [{ userType: kind }, { pendingProfessionalType: kind }],
  };
  if (excludeInactive !== "false") {
    query.isInActive = { $ne: true };
  }
  if (search && search.toString().trim()) {
    const regex = new RegExp(
      search.toString().trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i"
    );
    query.$and = [
      {
        $or: [
          { email: regex },
          { firstName: regex },
          { lastName: regex },
          { phoneNumber: regex },
          { accountId: regex },
        ],
      },
    ];
  }

  const sortField = ALLOWED_SORT_FIELDS.has(String(sortBy)) ? String(sortBy) : "createdAt";
  const sortObj: Record<string, 1 | -1> = {};
  sortObj[sortField] = sortOrder === "asc" ? 1 : -1;

  const users = await DB.Models.User.find(query)
    .select("-password -googleId -facebookId")
    .sort(sortObj)
    .skip(skip)
    .limit(safeLimit)
    .lean();

  const userIds = users.map((u) => u._id);
  const kycByUserId = new Map<string, string>();
  const slugByUserId = new Map<string, string | null>();
  if (userIds.length > 0) {
    const profiles = await profileModel(kind)
      .find({ userId: { $in: userIds } })
      .select("userId kycStatus")
      .lean();
    for (const row of profiles) {
      kycByUserId.set(String(row.userId), row.kycStatus || "none");
    }
    const dealSites = await DB.Models.DealSite.find({
      createdBy: { $in: userIds },
    })
      .sort({ createdAt: -1 })
      .select("createdBy publicSlug")
      .lean();
    for (const row of dealSites) {
      const uid = String(row.createdBy);
      if (!slugByUserId.has(uid)) {
        slugByUserId.set(uid, row.publicSlug ?? null);
      }
    }
  }

  const data = users.map((u) => ({
    ...u,
    kycStatus: kycByUserId.get(String(u._id)) || "none",
    publicSlug: slugByUserId.get(String(u._id)) ?? null,
  }));
  const total = await DB.Models.User.countDocuments(query);

  return res.status(HttpStatusCodes.OK).json({
    success: true,
    message: `${kind}s fetched successfully`,
    data,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  });
}

async function deleteProfessionalAccount(kind: Kind, req: AppRequest, res: Response) {
  const { userId } = req.params;
  const { reason } = req.body as { reason?: string };

  if (!mongoose.isValidObjectId(userId)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid user id");
  }
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      message: "Reason for deletion is required.",
    });
  }

  const user = await DB.Models.User.findOneAndUpdate(
    {
      _id: userId,
      isDeleted: { $ne: true },
      $or: [{ userType: kind }, { pendingProfessionalType: kind }],
    },
    {
      $set: {
        isDeleted: true,
        accountStatus: "deleted",
        isInActive: true,
        accountApproved: false,
      },
    },
    { new: true }
  ).exec();

  if (!user) {
    throw new RouteError(
      HttpStatusCodes.NOT_FOUND,
      `${kind} not found or already deleted.`
    );
  }

  await DB.Models.DealSite.updateMany(
    { createdBy: user._id },
    { $set: { status: "deleted" } }
  ).exec();

  if (user.email) {
    try {
      await sendEmail({
        to: user.email,
        subject: `Your ${kind.toLowerCase()} account has been closed`,
        text: `Hello ${user.firstName || kind}. Your ${kind.toLowerCase()} account has been closed. Reason: ${reason.trim()}`,
      });
    } catch (emailErr) {
      console.warn(`[delete${kind}Account] email failed:`, emailErr);
    }
  }

  return res.status(HttpStatusCodes.OK).json({
    success: true,
    message: `${kind} account deleted successfully.`,
  });
}

export const listAllLawyers = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    await listAllProfessionals("Lawyer", req, res);
  } catch (err) {
    next(err);
  }
};

export const listAllSurveyors = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    await listAllProfessionals("Surveyor", req, res);
  } catch (err) {
    next(err);
  }
};

export const listAllValuers = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    await listAllProfessionals("Valuer", req, res);
  } catch (err) {
    next(err);
  }
};

export const deleteLawyerAccount = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    await deleteProfessionalAccount("Lawyer", req, res);
  } catch (err) {
    next(err);
  }
};

export const deleteSurveyorAccount = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    await deleteProfessionalAccount("Surveyor", req, res);
  } catch (err) {
    next(err);
  }
};

export const deleteValuerAccount = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    await deleteProfessionalAccount("Valuer", req, res);
  } catch (err) {
    next(err);
  }
};
