import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { Types } from "mongoose";

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

    const preference = await DB.Models.Preference.findById(preferenceId);
    if (!preference) {
      return next(
        new RouteError(HttpStatusCodes.NOT_FOUND, "Preference not found"),
      );
    }

    const existingRecord = await DB.Models.MatchedPreferenceProperty.findOne({
      preference: preferenceId,
      buyer: preference.buyer,
    });

    if (existingRecord) {
      const newUniqueIds = matchedPropertyIds.filter(
        (id: string) =>
          !existingRecord.matchedProperties.some((existingId) =>
            existingId.equals(id),
          ),
      );

      if (newUniqueIds.length > 0) {
        existingRecord.matchedProperties.push(
          ...newUniqueIds.map((id: string) => new Types.ObjectId(id)),
        );
        if (notes) existingRecord.notes = notes;
        await existingRecord.save();
      }

      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: "Matched properties updated successfully",
        data: existingRecord,
      });
    }

    const createdRecord = await DB.Models.MatchedPreferenceProperty.create({
      preference: preferenceId,
      buyer: preference.buyer,
      matchedProperties: matchedPropertyIds.map(
        (id: string) => new Types.ObjectId(id),
      ),
      notes: notes || "",
    });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Matched properties saved successfully",
      data: createdRecord,
    });
  } catch (err) {
    next(err);
  }
};
