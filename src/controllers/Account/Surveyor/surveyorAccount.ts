import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import {
  assertSurveyorFeeInRange,
  getSurveyorFeeBounds,
  getSurveyorPlatformChargePercent,
} from "../../../services/professionalFee.service";
import { PaystackService } from "../../../services/paystack.service";

function requireSurveyor(req: AppRequest) {
  if (!req.user?._id || req.user.userType !== "Surveyor") {
    throw new RouteError(HttpStatusCodes.FORBIDDEN, "Surveyor account required.");
  }
  return req.user;
}

async function getOrCreateProfile(userId: string) {
  let profile = await DB.Models.SurveyorProfile.findOne({ userId });
  if (!profile) {
    profile = await DB.Models.SurveyorProfile.create({
      userId,
      surveyFee: 0,
      kycStatus: "none",
      isMarketplaceVisible: false,
      serviceTypes: ["plan-verification"],
    });
  }
  return profile;
}

export const getSurveyorMe = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireSurveyor(req);
    const profile = await getOrCreateProfile(String(user._id));
    const bounds = await getSurveyorFeeBounds();
    const platformChargePercent = await getSurveyorPlatformChargePercent();
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

export const updateSurveyorProfile = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireSurveyor(req);
    const profile = await getOrCreateProfile(String(user._id));
    const {
      firmName,
      profilePhoto,
      bio,
      serviceTypes,
      surveyFee,
      licenseNumber,
    } = req.body;

    if (surveyFee !== undefined) {
      await assertSurveyorFeeInRange(Number(surveyFee));
      profile.surveyFee = Number(surveyFee);
    }
    if (firmName !== undefined) profile.firmName = String(firmName).trim();
    if (profilePhoto !== undefined) profile.profilePhoto = String(profilePhoto).trim();
    if (bio !== undefined) profile.bio = String(bio).trim();
    if (Array.isArray(serviceTypes)) {
      profile.serviceTypes = serviceTypes.filter((s: string) =>
        ["plan-verification", "site-survey"].includes(s)
      );
    }
    if (licenseNumber !== undefined) profile.licenseNumber = String(licenseNumber).trim();
    await profile.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Surveyor profile updated.",
      data: profile,
    });
  } catch (err) {
    next(err);
  }
};

export const submitSurveyorKyc = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireSurveyor(req);
    const profile = await getOrCreateProfile(String(user._id));
    const { kycDocuments, licenseNumber, surveyFee, bio, profilePhoto } = req.body;

    if (!Array.isArray(kycDocuments) || kycDocuments.length === 0) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Upload at least one professional document for KYC."
      );
    }
    if (surveyFee !== undefined) {
      await assertSurveyorFeeInRange(Number(surveyFee));
      profile.surveyFee = Number(surveyFee);
    } else if (!profile.surveyFee) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Set a survey fee within the allowed range before submitting KYC."
      );
    } else {
      await assertSurveyorFeeInRange(profile.surveyFee);
    }

    profile.kycDocuments = kycDocuments
      .map((d: any) => ({
        name: String(d.name || "Document"),
        url: String(d.url || ""),
      }))
      .filter((d: any) => d.url);
    if (!profile.kycDocuments.length) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "KYC document URLs are required.");
    }
    if (licenseNumber) profile.licenseNumber = String(licenseNumber).trim();
    if (bio) profile.bio = String(bio).trim();
    if (profilePhoto) profile.profilePhoto = String(profilePhoto).trim();
    profile.kycStatus = "pending";
    profile.isMarketplaceVisible = false;
    await profile.save();

    await DB.Models.User.findByIdAndUpdate(user._id, { accountApproved: false });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "KYC submitted. Awaiting Khabi-Teq admin approval.",
      data: profile,
    });
  } catch (err) {
    next(err);
  }
};

export const setupSurveyorBank = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireSurveyor(req);
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

export const listSurveyorJobs = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireSurveyor(req);
    const jobs = await DB.Models.SurveyRequest.find({ surveyorId: user._id })
      .populate("buyerId", "fullName email phoneNumber")
      .sort({ createdAt: -1 })
      .lean();
    return res.status(HttpStatusCodes.OK).json({ success: true, data: jobs });
  } catch (err) {
    next(err);
  }
};
