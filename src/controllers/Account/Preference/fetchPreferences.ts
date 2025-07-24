import { Response, NextFunction } from "express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { AppRequest } from "../../../types/express";
import mongoose from "mongoose";

export const getMatchedPreferencesForOwner = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const ownerId = req.user._id;

    // Step 1: Find all property IDs owned by this user
    const ownerProperties = await DB.Models.Property.find({ owner: ownerId }).select("_id");
    const propertyIds = ownerProperties.map((prop) => prop._id);

    if (!propertyIds.length) {
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        data: [],
        message: "No properties found for this owner.",
      });
    }

    // Step 2: Find matched preferences where matchedProperties contains any of the owner's property IDs
    const matchedPreferences = await DB.Models.MatchedPreferenceProperty.find({
      matchedProperties: { $in: propertyIds },
    })
      .populate("preference")
      .populate("buyer")
      .populate("matchedProperties");

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: matchedPreferences,
    });
  } catch (err) {
    next(err);
  }
};


export const getOneMatchedPreferenceForOwner = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { matchedId } = req.params;
    const ownerId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(matchedId)) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Invalid matched ID.",
      });
    }

    // Step 1: Get all property IDs owned by the current user
    const ownerProperties = await DB.Models.Property.find({ owner: ownerId }).select("_id");
    const propertyIds = ownerProperties.map((prop) => prop._id);

    if (!propertyIds.length) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "You do not have any properties matched to this preference.",
      });
    }

    // Step 2: Find the specific match ensuring it includes one of the user's properties
    const match = await DB.Models.MatchedPreferenceProperty.findOne({
      _id: matchedId,
      matchedProperties: { $in: propertyIds },
    })
      .populate("preference")
      .populate("buyer")
      .populate("matchedProperties");

    if (!match) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Match not found or you don't have access to it.",
      });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: match,
    });
  } catch (err) {
    next(err);
  }
};
