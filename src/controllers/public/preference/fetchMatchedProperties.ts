import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import mongoose from "mongoose";
import { formatPropertyDataForTable } from "../../../utils/propertyFormatters";

export const getPaginatedMatchedProperties = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const { matchedId, preferenceId } = req.params;

    // ✅ Validate matchedId
    if (!matchedId || !mongoose.Types.ObjectId.isValid(matchedId.toString())) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid or missing matchedId");
    }

    // ✅ Find the matched record
    const match = await DB.Models.MatchedPreferenceProperty.findById(matchedId)
      .populate({
        path: "matchedProperties",
        populate: { path: "owner" },
      })
      .populate("preference")
      .lean();

    if (!match) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Matched record not found");
    }

    const total = match.matchedProperties?.length || 0;
    const paginatedProperties = match.matchedProperties.slice(skip, skip + limit);

    const formattedProperties = paginatedProperties.map((property: any) => {
      const formatted = formatPropertyDataForTable(property);
      return { ...formatted, matchedId: match._id }; // attach matchedId to each
    });

    const result = {
      matchDetails: {
        _id: match._id,
        status: match.status,
        notes: match.notes,
        createdAt: match.createdAt,
        updatedAt: match.updatedAt,
      },
      preference: match.preference,
      matchedProperties: formattedProperties,
    };

    res.status(HttpStatusCodes.OK).json({
      success: true,
      data: result,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    next(error);
  }
};
