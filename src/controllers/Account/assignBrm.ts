import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { AppRequest } from "../../types/express";
import { isBrmBookUserType } from "../../common/constants/brmBook";

export async function resolveActiveBrmId(
  raw: unknown
): Promise<mongoose.Types.ObjectId | null> {
  if (raw === null || raw === undefined || raw === "") return null;
  const id = String(raw).trim();
  if (!mongoose.isValidObjectId(id)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid BRM id");
  }
  const brm = await DB.Models.BusinessRelationManager.findOne({
    _id: id,
    isActive: true,
  }).select("_id");
  if (!brm) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Selected BRM is not available"
    );
  }
  return brm._id as mongoose.Types.ObjectId;
}

export const updateAccountBrm = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
    }

    const user = await DB.Models.User.findById(userId);
    if (!user) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "User not found");
    }

    if (!isBrmBookUserType(user.userType)) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Only agents, developers, lawyers, valuers, and surveyors can assign a BRM"
      );
    }

    const resolved = await resolveActiveBrmId(req.body?.brmId);
    const updated = resolved
      ? await DB.Models.User.findByIdAndUpdate(
          userId,
          { brmId: resolved, brmAssignedAt: new Date() },
          { new: true }
        )
      : await DB.Models.User.findByIdAndUpdate(
          userId,
          { $unset: { brmId: 1, brmAssignedAt: 1 } },
          { new: true }
        );

    const brm = updated?.brmId
      ? await DB.Models.BusinessRelationManager.findById(updated.brmId)
          .select("fullName profilePicture phoneNumber gender serviceMessage")
          .lean()
      : null;

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: updated?.brmId ? "BRM assigned" : "BRM cleared",
      data: {
        brmId: updated?.brmId || null,
        brm: brm
          ? {
              id: brm._id,
              fullName: brm.fullName,
              profilePicture: brm.profilePicture,
              phoneNumber: brm.phoneNumber,
              gender: brm.gender,
              serviceMessage: brm.serviceMessage,
            }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
};
