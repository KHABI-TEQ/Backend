import { Response, NextFunction } from "express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { AppRequest } from "../../types/express";
import { resolveActiveBrmId } from "../Account/assignBrm";
import { buyerPublic } from "./profile";

export const updateBuyerBrm = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.buyer?._id) {
      throw new RouteError(
        HttpStatusCodes.UNAUTHORIZED,
        "Buyer not authenticated."
      );
    }

    const resolved = await resolveActiveBrmId(req.body?.brmId);
    const updated = resolved
      ? await DB.Models.Buyer.findByIdAndUpdate(
          req.buyer._id,
          { brmId: resolved },
          { new: true }
        )
      : await DB.Models.Buyer.findByIdAndUpdate(
          req.buyer._id,
          { $unset: { brmId: 1 } },
          { new: true }
        );

    if (!updated) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Buyer not found.");
    }

    const brm = updated.brmId
      ? await DB.Models.BusinessRelationManager.findById(updated.brmId)
          .select("fullName profilePicture phoneNumber gender serviceMessage")
          .lean()
      : null;

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: updated.brmId ? "BRM assigned" : "BRM cleared",
      data: {
        buyer: buyerPublic(updated),
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
