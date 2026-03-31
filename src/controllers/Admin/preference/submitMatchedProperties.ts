import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { Types } from "mongoose";
import { persistMatchedPreferenceProperties } from "../../../services/matchedPreferencePersistence.service";

export const selectMatchedPreferenceProperties = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { preferenceId, matchedPropertyIds = [], notes } = req.body;

    if (
      !preferenceId ||
      !Array.isArray(matchedPropertyIds) ||
      matchedPropertyIds.length === 0
    ) {
      return next(
        new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          "preferenceId and matchedPropertyIds are required",
        ),
      );
    }

    const preference = await DB.Models.Preference.findById(preferenceId).populate("buyer");
    if (!preference) {
      return next(
        new RouteError(HttpStatusCodes.NOT_FOUND, "Preference not found"),
      );
    }

    const objectIds = matchedPropertyIds.map((id: string) => new Types.ObjectId(id));

    const result = await persistMatchedPreferenceProperties({
      preferenceId,
      matchedPropertyIds: objectIds,
      notes,
      sendMatchEmail: true,
      forceSendMatchEmail: true,
    });

    if (!result) {
      return next(new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, "Failed to save matches"));
    }

    const { matchedRecord, wasUpdated } = result;

    return res.status(
      wasUpdated ? HttpStatusCodes.OK : HttpStatusCodes.CREATED
    ).json({
      success: true,
      message: wasUpdated
        ? "Matched properties updated successfully"
        : "Matched properties saved successfully",
      data: matchedRecord,
    });
  } catch (err) {
    next(err);
  }
};
