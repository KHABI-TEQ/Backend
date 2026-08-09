import { Response, NextFunction } from "express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { AppRequest } from "../../types/express";
import { RouteError } from "../../common/classes";
import {
  getLawyerFeeBounds,
  getSurveyorFeeBounds,
} from "../../services/professionalFee.service";
import { PaystackService } from "../../services/paystack.service";
import { Types } from "mongoose";
import {
  assertSurveyorFeeInRange,
  getSurveyorPlatformChargePercent,
} from "../../services/professionalFee.service";

export const listMarketplaceLawyers = async (
  _req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const bounds = await getLawyerFeeBounds();
    const profiles = await DB.Models.LawyerProfile.find({
      isMarketplaceVisible: true,
      kycStatus: "approved",
      verificationFee: { $gte: bounds.min, $lte: bounds.max },
    })
      .populate("userId", "firstName lastName email profile_picture")
      .sort({ verificationFee: 1 })
      .lean();

    const data = profiles.map((p: any) => ({
      id: String(p.userId?._id || p.userId),
      profileId: String(p._id),
      firstName: p.userId?.firstName || "",
      lastName: p.userId?.lastName || "",
      fullName: `${p.userId?.firstName || ""} ${p.userId?.lastName || ""}`.trim(),
      email: p.userId?.email || "",
      profilePhoto: p.profilePhoto || p.userId?.profile_picture || "",
      bio: p.bio || "",
      firmName: p.firmName || "",
      practiceAreas: p.practiceAreas || [],
      verificationFee: p.verificationFee,
    }));

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data,
      feeBounds: bounds,
    });
  } catch (err) {
    next(err);
  }
};

export const getMarketplaceLawyer = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const profile = await DB.Models.LawyerProfile.findOne({
      userId: req.params.id,
      isMarketplaceVisible: true,
      kycStatus: "approved",
    })
      .populate("userId", "firstName lastName email profile_picture phoneNumber")
      .lean();
    if (!profile) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Lawyer not found.");
    }
    const u: any = profile.userId;
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: {
        id: String(u?._id || profile.userId),
        firstName: u?.firstName,
        lastName: u?.lastName,
        fullName: `${u?.firstName || ""} ${u?.lastName || ""}`.trim(),
        email: u?.email,
        profilePhoto: profile.profilePhoto || u?.profile_picture || "",
        bio: profile.bio,
        firmName: profile.firmName,
        practiceAreas: profile.practiceAreas,
        verificationFee: profile.verificationFee,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const listMarketplaceSurveyors = async (
  _req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const bounds = await getSurveyorFeeBounds();
    const profiles = await DB.Models.SurveyorProfile.find({
      isMarketplaceVisible: true,
      kycStatus: "approved",
      surveyFee: { $gte: bounds.min, $lte: bounds.max },
    })
      .populate("userId", "firstName lastName email profile_picture")
      .sort({ surveyFee: 1 })
      .lean();

    const data = profiles.map((p: any) => ({
      id: String(p.userId?._id || p.userId),
      profileId: String(p._id),
      firstName: p.userId?.firstName || "",
      lastName: p.userId?.lastName || "",
      fullName: `${p.userId?.firstName || ""} ${p.userId?.lastName || ""}`.trim(),
      email: p.userId?.email || "",
      profilePhoto: p.profilePhoto || p.userId?.profile_picture || "",
      bio: p.bio || "",
      firmName: p.firmName || "",
      serviceTypes: p.serviceTypes || [],
      surveyFee: p.surveyFee,
    }));

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data,
      feeBounds: bounds,
    });
  } catch (err) {
    next(err);
  }
};

export const createSurveyRequest = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      contactInfo,
      surveyorId,
      serviceType,
      propertyAddress,
      surveyPlanUrl,
      notes,
      amountPaid,
    } = req.body;

    if (!contactInfo?.email || !surveyorId || !serviceType || amountPaid == null) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Missing required fields.");
    }
    if (!["plan-verification", "site-survey"].includes(serviceType)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid serviceType.");
    }

    const surveyorUser = await DB.Models.User.findById(surveyorId);
    if (!surveyorUser || surveyorUser.userType !== "Surveyor") {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid surveyor.");
    }
    const profile = await DB.Models.SurveyorProfile.findOne({
      userId: surveyorId,
      isMarketplaceVisible: true,
      kycStatus: "approved",
    });
    if (!profile) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Surveyor is not available on the marketplace."
      );
    }

    await assertSurveyorFeeInRange(profile.surveyFee);
    if (Number(amountPaid) !== Number(profile.surveyFee)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        `Invalid payment amount. Expected ${profile.surveyFee}.`
      );
    }

    const buyer = await DB.Models.Buyer.findOneAndUpdate(
      { email: String(contactInfo.email).toLowerCase().trim() },
      { $setOnInsert: contactInfo },
      { upsert: true, new: true }
    );

    const platformPct = await getSurveyorPlatformChargePercent();
    const platformCharge = Math.round((profile.surveyFee * platformPct) / 100);
    const publicPageUrl =
      process.env.CLIENT_LINK?.replace(/\/$/, "") || "https://khabiteq.com";

    let paymentResponse;
    if (profile.paystackSubaccountCode) {
      paymentResponse = await PaystackService.initializeSplitPayment({
        subAccount: profile.paystackSubaccountCode,
        publicPageUrl,
        amountCharge: platformCharge,
        email: contactInfo.email,
        amount: profile.surveyFee,
        fromWho: {
          kind: "Buyer",
          item: new Types.ObjectId(buyer._id as Types.ObjectId),
        },
        transactionType: "survey-request",
        metadata: { surveyorId: String(surveyorId), serviceType },
      });
    } else {
      paymentResponse = await PaystackService.initializePayment({
        email: contactInfo.email,
        amount: profile.surveyFee,
        fromWho: {
          kind: "Buyer",
          item: new Types.ObjectId(buyer._id as Types.ObjectId),
        },
        transactionType: "survey-request",
        metadata: { surveyorId: String(surveyorId), serviceType },
      });
    }

    const request = await DB.Models.SurveyRequest.create({
      buyerId: buyer._id,
      surveyorId,
      serviceType,
      propertyAddress,
      surveyPlanUrl,
      notes,
      amountPaid: profile.surveyFee,
      transaction: paymentResponse.transactionId,
      status: "pending",
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Survey request submitted.",
      data: {
        request,
        payment: {
          authorization_url: paymentResponse.authorization_url,
          reference: paymentResponse.reference,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};
