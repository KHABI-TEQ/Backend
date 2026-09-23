import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import sendEmail from "../../../common/send.email";
import { provisionProfessionalSiteOnKycApprove } from "../../../services/professionalSite.service";
import { completeProfessionalUpgradeIfPending } from "../../../services/professionalUpgrade.service";

type Kind = "Lawyer" | "Surveyor" | "Valuer";

const USER_SELECT =
  "firstName lastName email phoneNumber accountId accountApproved accountStatus profile_picture createdAt isAccountVerified userType";

async function findProfessionalProfile(kind: Kind, userId: string) {
  if (kind === "Lawyer") {
    return DB.Models.LawyerProfile.findOne({ userId }).lean();
  }
  if (kind === "Surveyor") {
    return DB.Models.SurveyorProfile.findOne({ userId }).lean();
  }
  return DB.Models.ValuerProfile.findOne({ userId }).lean();
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

  const profile =
    kind === "Lawyer"
      ? await DB.Models.LawyerProfile.findOne({ userId: user._id })
      : kind === "Surveyor"
        ? await DB.Models.SurveyorProfile.findOne({ userId: user._id })
        : await DB.Models.ValuerProfile.findOne({ userId: user._id });
  if (!profile) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, `${kind} profile not found.`);
  }

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
      kycStatus: { $in: ["pending", "in_review"] },
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
      kycStatus: { $in: ["pending", "in_review"] },
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
      kycStatus: { $in: ["pending", "in_review"] },
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
