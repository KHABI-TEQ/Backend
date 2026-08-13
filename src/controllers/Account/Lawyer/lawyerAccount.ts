import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import {
  assertLawyerFeeInRange,
  getLawyerFeeBounds,
  getLawyerPlatformChargePercent,
} from "../../../services/professionalFee.service";
import { PaystackService } from "../../../services/paystack.service";
import sendEmail from "../../../common/send.email";

function requireLawyer(req: AppRequest) {
  if (!req.user?._id || req.user.userType !== "Lawyer") {
    throw new RouteError(HttpStatusCodes.FORBIDDEN, "Lawyer account required.");
  }
  return req.user;
}

async function getOrCreateProfile(userId: string) {
  let profile = await DB.Models.LawyerProfile.findOne({ userId });
  if (!profile) {
    profile = await DB.Models.LawyerProfile.create({
      userId,
      verificationFee: 0,
      kycStatus: "none",
      isMarketplaceVisible: false,
    });
  }
  return profile;
}

export const getLawyerMe = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireLawyer(req);
    const profile = await getOrCreateProfile(String(user._id));
    const bounds = await getLawyerFeeBounds();
    const platformChargePercent = await getLawyerPlatformChargePercent();
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          profile_picture: user.profile_picture,
          accountApproved: user.accountApproved,
          isAccountVerified: user.isAccountVerified,
          accountStatus: user.accountStatus,
          userType: user.userType,
        },
        profile,
        feeBounds: bounds,
        platformChargePercent,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const updateLawyerProfile = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireLawyer(req);
    const profile = await getOrCreateProfile(String(user._id));
    const {
      firmName,
      profilePhoto,
      bio,
      practiceAreas,
      verificationFee,
      licenseNumber,
    } = req.body;

    if (verificationFee !== undefined) {
      await assertLawyerFeeInRange(Number(verificationFee));
      profile.verificationFee = Number(verificationFee);
    }
    if (firmName !== undefined) profile.firmName = String(firmName).trim();
    if (profilePhoto !== undefined) profile.profilePhoto = String(profilePhoto).trim();
    if (bio !== undefined) profile.bio = String(bio).trim();
    if (Array.isArray(practiceAreas)) profile.practiceAreas = practiceAreas.map(String);
    if (licenseNumber !== undefined) profile.licenseNumber = String(licenseNumber).trim();

    await profile.save();

    if (profilePhoto && !user.profile_picture) {
      await DB.Models.User.findByIdAndUpdate(user._id, {
        profile_picture: profilePhoto,
      });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Lawyer profile updated.",
      data: profile,
    });
  } catch (err) {
    next(err);
  }
};

export const submitLawyerKyc = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireLawyer(req);
    const profile = await getOrCreateProfile(String(user._id));
    const { kycDocuments, licenseNumber, verificationFee, bio, profilePhoto } =
      req.body;

    if (!Array.isArray(kycDocuments) || kycDocuments.length === 0) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Upload at least one professional document for KYC."
      );
    }

    if (verificationFee !== undefined) {
      await assertLawyerFeeInRange(Number(verificationFee));
      profile.verificationFee = Number(verificationFee);
    } else if (!profile.verificationFee) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Set a verification fee within the allowed range before submitting KYC."
      );
    } else {
      await assertLawyerFeeInRange(profile.verificationFee);
    }

    profile.kycDocuments = kycDocuments.map((d: any) => ({
      name: String(d.name || "Document"),
      url: String(d.url || ""),
    })).filter((d: any) => d.url);
    if (!profile.kycDocuments.length) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "KYC document URLs are required.");
    }
    if (licenseNumber) profile.licenseNumber = String(licenseNumber).trim();
    if (bio) profile.bio = String(bio).trim();
    if (profilePhoto) profile.profilePhoto = String(profilePhoto).trim();
    profile.kycStatus = "pending";
    profile.isMarketplaceVisible = false;
    await profile.save();

    await DB.Models.User.findByIdAndUpdate(user._id, {
      accountApproved: false,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "KYC submitted. Awaiting Khabi-Teq admin approval.",
      data: profile,
    });
  } catch (err) {
    next(err);
  }
};

export const setupLawyerBank = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireLawyer(req);
    const profile = await getOrCreateProfile(String(user._id));
    const { businessName, bankCode, accountNumber } = req.body;
    if (!businessName || !bankCode || !accountNumber) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "businessName, bankCode and accountNumber are required."
      );
    }

    const sub = await PaystackService.createSubaccount({
      businessName: String(businessName).trim(),
      settlementBank: String(bankCode).trim(),
      accountNumber: String(accountNumber).trim(),
      percentageCharge: 0,
      primaryContactEmail: user.email,
      primaryContactName: `${user.firstName} ${user.lastName}`.trim(),
      primaryContactPhone: user.phoneNumber,
    });

    profile.bankDetails = {
      businessName: String(businessName).trim(),
      bankCode: String(bankCode).trim(),
      accountNumber: String(accountNumber).trim(),
      accountName: sub.accountName || "",
    };
    profile.paystackSubaccountCode = sub.subAccountCode;
    profile.paystackSubaccountId = sub.subAccountCode;
    await profile.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Settlement account connected.",
      data: {
        paystackSubaccountCode: profile.paystackSubaccountCode,
        bankDetails: profile.bankDetails,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const listLawyerVerificationJobs = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireLawyer(req);
    const status = req.query.status as string | undefined;
    const filter: Record<string, unknown> = { lawyerId: user._id };
    if (status) filter.status = status;

    const jobs = await DB.Models.DocumentVerification.find(filter)
      .populate("buyerId", "fullName email phoneNumber")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(HttpStatusCodes.OK).json({ success: true, data: jobs });
  } catch (err) {
    next(err);
  }
};

export const getLawyerVerificationJob = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireLawyer(req);
    const job = await DB.Models.DocumentVerification.findOne({
      _id: req.params.id,
      lawyerId: user._id,
    })
      .populate("buyerId", "fullName email phoneNumber")
      .lean();
    if (!job) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Job not found.");
    }
    return res.status(HttpStatusCodes.OK).json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
};

export const submitLawyerVerificationReport = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireLawyer(req);
    const { status, description, newDocumentUrl } = req.body as {
      status: "registered" | "unregistered";
      description?: string;
      newDocumentUrl?: string;
    };
    if (!["registered", "unregistered"].includes(status)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "status must be registered or unregistered."
      );
    }

    const job = await DB.Models.DocumentVerification.findOne({
      _id: req.params.id,
      lawyerId: user._id,
    });
    if (!job) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Job not found.");
    }
    if (!["payment-approved", "in-progress"].includes(job.status)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Job is not ready for a verification report."
      );
    }

    job.status = status;
    job.verificationReports = {
      originalDocumentType: job.docType,
      newDocumentUrl: newDocumentUrl || "",
      description: description || "",
      status,
      verifiedAt: new Date(),
      selfVerification: false,
    };
    await job.save();

    const buyer = await DB.Models.Buyer.findById(job.buyerId);
    if (buyer?.email) {
      const { buildBuyerDocumentMeta } = await import(
        "../../../utils/notificationDeepLinks"
      );
      const docId = String(job._id || "");
      await sendEmail({
        to: buyer.email,
        subject: `Document verification result: ${status}`,
        text: `Your ${job.docType} verification (code ${job.docCode}) was marked ${status}. ${description || ""} Open Document verification in the Khabi-Teq app.`,
        inboxMeta: docId
          ? buildBuyerDocumentMeta(docId)
          : {
              source: "system",
              audience: "buyer",
              screen: "documents",
              actionPath: "/documents",
            },
      });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Verification report submitted.",
      data: job,
    });
  } catch (err) {
    next(err);
  }
};
