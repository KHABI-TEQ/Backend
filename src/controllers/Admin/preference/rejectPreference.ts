import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";

export const rejectPreference = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { preferenceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(preferenceId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid preference ID");
    }

    const preference = await DB.Models.Preference.findById(preferenceId);
    if (!preference) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Preference not found");
    }

    if (preference.status === "rejected") {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Preference is already rejected",
      );
    }

    preference.status = "rejected";
    await preference.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Preference rejected successfully",
      data: preference,
    });
  } catch (err) {
    next(err);
  }
};