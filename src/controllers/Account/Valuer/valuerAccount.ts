import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import {
  acceptCatalogServiceRequest,
  getCatalogJobForProfessional,
  listCatalogJobsForProfessional,
  submitServiceOffer,
} from "../../../services/professionalCatalog.service";
import { PaystackService } from "../../../services/paystack.service";

function requireValuerOrUpgrade(req: AppRequest) {
  const pending = (req.user as any)?.pendingProfessionalType;
  if (
    !req.user?._id ||
    (req.user.userType !== "Valuer" &&
      !(req.user.userType === "PropertyScout" && pending === "Valuer"))
  ) {
    throw new RouteError(HttpStatusCodes.FORBIDDEN, "Valuer account required.");
  }
  return req.user;
}

async function getOrCreateProfile(userId: string) {
  let profile = await DB.Models.ValuerProfile.findOne({ userId });
  if (!profile) {
    profile = await DB.Models.ValuerProfile.create({
      userId,
      kycStatus: "none",
      isMarketplaceVisible: false,
    });
  }
  return profile;
}

export const getValuerMe = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const user = requireValuerOrUpgrade(req);
    const profile = await getOrCreateProfile(String(user._id));
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: { user: { id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName }, profile },
    });
  } catch (err) {
    next(err);
  }
};

export const submitValuerKyc = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const user = requireValuerOrUpgrade(req);
    const profile = await getOrCreateProfile(String(user._id));
    const docs = Array.isArray(req.body?.kycDocuments) ? req.body.kycDocuments : [];
    if (!docs.length) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "At least one KYC document is required.");
    }
    profile.kycDocuments = docs;
    if (req.body?.licenseNumber) profile.licenseNumber = String(req.body.licenseNumber).trim();
    if (req.body?.certificateKind === "cac" || req.body?.certificateKind === "lasrera") {
      profile.certificateKind = req.body.certificateKind;
    }
    if (req.body?.certificateNumber) profile.certificateNumber = String(req.body.certificateNumber).trim();
    if (req.body?.firmName) profile.firmName = String(req.body.firmName).trim();
    if (req.body?.bio) profile.bio = String(req.body.bio).trim();
    profile.kycStatus = "pending";
    await profile.save();
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "KYC submitted successfully. Please await admin approval within 24 hours.",
      data: profile,
    });
  } catch (err) {
    next(err);
  }
};

export const listValuerJobs = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireValuerOrUpgrade(req);
    const jobs = await listCatalogJobsForProfessional(String(user._id), "valuer");
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: jobs,
    });
  } catch (err) {
    next(err);
  }
};

export const getValuerJob = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireValuerOrUpgrade(req);
    const job = await getCatalogJobForProfessional({
      requestId: req.params.id,
      userId: String(user._id),
      category: "valuer",
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: job,
    });
  } catch (err) {
    next(err);
  }
};

export const setupValuerBank = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireValuerOrUpgrade(req);
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

export const respondValuerJob = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = requireValuerOrUpgrade(req);
    if (req.body?.coverageNote || req.body?.fee) {
      const job = await submitServiceOffer({
        requestId: req.params.id,
        userId: String(user._id),
        coverageNote: String(req.body.coverageNote || ""),
        fee: Number(req.body.fee),
        serviceItems: req.body.serviceItems,
        commissionAccepted: req.body.commissionAccepted === true,
        letterheadReportAccepted: req.body.letterheadReportAccepted === true,
      });
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: "Offer sent. The client can compare it with other professionals.",
        data: job,
      });
    }
    const accept = req.body?.accept === true;
    const reason = req.body?.reason as string | undefined;
    const job = await acceptCatalogServiceRequest({
      requestId: req.params.id,
      userId: String(user._id),
      accept,
      reason,
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: accept
        ? "Request accepted. The client has been asked to pay."
        : "You declined this request. It remains open for other professionals.",
      data: job,
    });
  } catch (err) {
    next(err);
  }
};
