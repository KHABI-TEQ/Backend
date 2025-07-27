import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { formatPreferenceForFrontend, PreferencePayload } from "../../../utils/preferenceFormatter";

export const fetchSinglePreference = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { preferenceId } = req.params;

    if (!preferenceId) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Preference ID is required");
    }

    const preference = await DB.Models.Preference.findById(preferenceId)
      .populate("buyer");

    if (!preference) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Preference not found");
    }

    const plainObj = preference.toObject({ getters: true, virtuals: true });
    const formatted = formatPreferenceForFrontend(plainObj as unknown as PreferencePayload);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Preference fetched successfully",
      data: formatted,
    });
  } catch (err) {
    next(err);
  }
};
