import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";

export const getBuyerPreferenceById = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { buyerId, preferenceId } = req.params;

    if (!buyerId || !preferenceId) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "buyerId and preferenceId are required",
      });
    }

    const preference = await DB.Models.Preference.findOne({
      _id: preferenceId,
      buyer: buyerId,
    })
      .populate("buyer")
      .populate("assignedAgent")
      .lean();

    if (!preference) {
      return next(
        new RouteError(
          HttpStatusCodes.NOT_FOUND,
          "Preference not found for this buyer",
        ),
      );
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Preference fetched successfully",
      data: preference,
    });
  } catch (err) {
    next(err);
  }
};
