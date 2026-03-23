import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import mongoose from "mongoose";
import { resolveLeanRefToObjectId } from "../../../utils/mongooseId";

export const getSingleDealSiteProperty = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { publicSlug, propertyId } = req.params;

    // ✅ Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        errorCode: "INVALID_PROPERTY_ID",
        message: "Invalid property id format",
        data: null,
      });
    }

    // ✅ Find DealSite
    const dealSite = await DB.Models.DealSite.findOne({ publicSlug }).lean();
    if (!dealSite) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        errorCode: "DEALSITE_NOT_FOUND",
        message: "DealSite not found",
        data: null,
      });
    }

    // ✅ Ensure it's running
    if (dealSite.status !== "running") {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        errorCode: "DEALSITE_NOT_ACTIVE",
        message: "This DealSite is not currently active.",
        data: null,
      });
    }

    const creatorId = resolveLeanRefToObjectId(dealSite.createdBy);
    if (!creatorId) {
      return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        errorCode: "DEALSITE_INVALID_OWNER",
        message: "DealSite owner reference is invalid.",
        data: null,
      });
    }

    // Find property (owned by DealSite creator or marketed by them via Request To Market; multiple agents can market the same property)
    const property = await DB.Models.Property.findOne({
      _id: propertyId,
      $or: [
        { owner: creatorId },
        { marketedByAgentIds: creatorId },
        { marketedByAgentId: creatorId }, // legacy single field
      ],
      isAvailable: true,
      isApproved: true,
      isDeleted: { $ne: true },
    }).lean();

    if (!property) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        errorCode: "PROPERTY_NOT_FOUND",
        message: "Property not found under this DealSite",
        data: null,
      });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      dealSite: {
        inspectionSettings: dealSite.inspectionSettings,
      },
      data: property,
    });
  } catch (err) {
    next(err);
  }
};
