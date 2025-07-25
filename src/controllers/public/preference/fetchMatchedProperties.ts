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

    const { buyerId, preferenceId } = req.query;

    // ✅ Validate ObjectIds
    if (buyerId && !mongoose.Types.ObjectId.isValid(buyerId.toString())) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid buyerId");
    }

    if (preferenceId && !mongoose.Types.ObjectId.isValid(preferenceId.toString())) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid preferenceId");
    }

    const filter: Record<string, any> = {};
    if (buyerId) filter.buyer = buyerId;
    if (preferenceId) filter.preference = preferenceId;

    const total = await DB.Models.MatchedPreferenceProperty.countDocuments(filter);

    const matches = await DB.Models.MatchedPreferenceProperty.find(filter)
      .skip(skip)
      .limit(limit)
      .populate({
        path: "matchedProperties",
        populate: { path: "owner" },
      })
      .populate("preference")
      .populate("buyer")
      .sort({ createdAt: -1 })
      .lean();

    const formattedMatches = matches.map((match) => {
      const formattedProperties = match.matchedProperties.map((property: any) =>
        formatPropertyDataForTable(property),
      );

      return {
        matchDetails: {
            _id: match._id,
            preference: match.preference,
            buyer: match.buyer,
            status: match.status,
            notes: match.notes,
            createdAt: match.createdAt,
            updatedAt: match.updatedAt,
        },
        matchedProperties: formattedProperties,
      };
    });

    res.status(HttpStatusCodes.OK).json({
      success: true,
      data: formattedMatches,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        total: total,
      },
    });
  } catch (error) {
    next(error);
  }
};
