import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";

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
    if (req.body?.firmName) profile.firmName = String(req.body.firmName).trim();
    if (req.body?.bio) profile.bio = String(req.body.bio).trim();
    profile.kycStatus = "pending";
    await profile.save();
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Valuer KYC submitted for review.",
      data: profile,
    });
  } catch (err) {
    next(err);
  }
};
