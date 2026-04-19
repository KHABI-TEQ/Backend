import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { DealSiteService } from "../../../services/dealSite.service";
import { dealSiteActivityService } from "../../../services/dealSiteActivity.service";

/**
 * POST /admin/users/:userId/deal-site/setup
 * Same payload as user POST /account/dealSite/setUp; subscription check is bypassed for admin-assisted onboarding.
 */
export const adminSetupDealSiteForUser = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid user id");
    }

    const owner = await DB.Models.User.findById(userId).select("userType email firstName").lean();
    if (!owner) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "User not found");
    }
    if (owner.userType !== "Agent" && owner.userType !== "Developer") {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Only Agent or Developer accounts can have a public access page."
      );
    }

    const dealSite = await DealSiteService.setUpPublicAccess(userId, req.body, {
      bypassSubscriptionCheck: true,
    });

    const adminActor = (req as AppRequest & { admin?: { _id: mongoose.Types.ObjectId } }).admin;
    await dealSiteActivityService.logActivity({
      dealSiteId: dealSite._id.toString(),
      actorId: adminActor?._id ?? userId,
      actorModel: "Admin",
      category: "deal-setUp",
      action: "Admin created public access page for user",
      description: `Admin provisioned DealSite for user ${userId}`,
      req,
    });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Public access page created successfully",
      data: dealSite,
    });
  } catch (err) {
    next(err);
  }
};
