import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import sendEmail from "../../../common/send.email";

type Kind = "Lawyer" | "Surveyor";

async function reviewProfessional(
  kind: Kind,
  userId: string,
  response: "approve" | "reject",
  note?: string
) {
  const user = await DB.Models.User.findById(userId);
  if (!user || user.userType !== kind) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, `${kind} account not found.`);
  }

  const profile =
    kind === "Lawyer"
      ? await DB.Models.LawyerProfile.findOne({ userId: user._id })
      : await DB.Models.SurveyorProfile.findOne({ userId: user._id });
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

  if (user.email) {
    await sendEmail({
      to: user.email,
      subject: approved
        ? `Your ${kind.toLowerCase()} account is activated`
        : `Your ${kind.toLowerCase()} KYC was rejected`,
      text: approved
        ? `Congratulations ${user.firstName}. Your ${kind.toLowerCase()} profile is approved and now visible on the Khabi-Teq marketplace.`
        : `Hello ${user.firstName}. Your ${kind.toLowerCase()} KYC was rejected. ${note || "Please update your documents and resubmit."}`,
    });
  }

  return { user, profile };
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
      .populate("userId", "firstName lastName email phoneNumber accountApproved")
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
      .populate("userId", "firstName lastName email phoneNumber accountApproved")
      .sort({ updatedAt: -1 })
      .lean();
    return res.status(HttpStatusCodes.OK).json({ success: true, data: profiles });
  } catch (err) {
    next(err);
  }
};
