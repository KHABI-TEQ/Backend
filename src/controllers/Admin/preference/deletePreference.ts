import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";

export const deletePreference = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { preferenceId } = req.params;

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(preferenceId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid preference ID");
    }

    // Find preference
    const preference = await DB.Models.Preference.findById(preferenceId);
    if (!preference) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Preference not found");
    }

    // Delete preference
    await DB.Models.Preference.findByIdAndDelete(preferenceId);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Preference deleted successfully",
      data: { _id: preferenceId },
    });
  } catch (err) {
    next(err);
  }
};
