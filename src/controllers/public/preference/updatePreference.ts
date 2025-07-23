import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { preferenceValidationSchema } from "../../../validators/preference.validator";

export const updateBuyerPreferenceById = async (
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

    // Validate Payload
    const payload = await preferenceValidationSchema.validateAsync(req.body, {
      abortEarly: false,
    });

    const updatedPreference = await DB.Models.Preference.findOneAndUpdate(
      { _id: preferenceId, buyer: buyerId },
      { $set: payload },
      { new: true },
    )
      .populate("buyer")
      .populate("assignedAgent");

    if (!updatedPreference) {
      return next(
        new RouteError(
          HttpStatusCodes.NOT_FOUND,
          "Preference not found for this buyer",
        ),
      );
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Preference updated successfully",
      data: updatedPreference,
    });
  } catch (err: any) {
    if (err?.isJoi) {
      const message = err.details?.map((e: any) => e.message).join(", ");
      return next(new RouteError(HttpStatusCodes.BAD_REQUEST, message));
    }

    next(err);
  }
};
