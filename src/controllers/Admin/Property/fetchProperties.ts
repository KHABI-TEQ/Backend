import { Response, NextFunction } from "express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { AppRequest } from "../../../types/express";
import { formatPropertyDataForTable } from "../../../utils/propertyFormatters";
import type { PipelineStage } from "mongoose";


export const getAllProperties = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filters = req.query;
    const matchStage: any = {};

    // Filter: Owner Type
    if (filters.ownerType && filters.ownerType !== "All") {
      matchStage["owner.userType"] = filters.ownerType;
    }

    // Boolean filters
    if (filters.isPremium !== undefined)
      matchStage.isPremium = filters.isPremium === "true";
    if (filters.isApproved !== undefined)
      matchStage.isApproved = filters.isApproved === "true";
    if (filters.isRejected !== undefined)
      matchStage.isRejected = filters.isRejected === "true";
    if (filters.isAvailable !== undefined)
      matchStage.isAvailable = filters.isAvailable;
    if (filters.isPreference !== undefined)
      matchStage.isPreference = filters.isPreference === "true";

    // Exact match
    if (filters.propertyType) {
      matchStage.propertyType = filters.propertyType;
    }

    // briefType array
    if (filters.briefType) {
      const briefTypes = Array.isArray(filters.briefType)
        ? filters.briefType
        : [filters.briefType];
      matchStage.briefType = { $in: briefTypes };
    }

    // buildingType array
    if (filters.buildingType) {
      const buildingTypes = Array.isArray(filters.buildingType)
        ? filters.buildingType
        : [filters.buildingType];
      matchStage.buildingType = { $in: buildingTypes };
    }

    // location matching
    if (filters.location) {
      const regex = new RegExp(filters.location as string, "i");
      matchStage.$or = [
        { "location.state": regex },
        { "location.localGovernment": regex },
        { "location.area": regex },
      ];
    }

    // price range
    if (filters.priceMin || filters.priceMax) {
      matchStage.price = {};
      if (filters.priceMin)
        matchStage.price.$gte = Number(filters.priceMin);
      if (filters.priceMax)
        matchStage.price.$lte = Number(filters.priceMax);
    }

    const page = parseInt(filters.page as string) || 1;
    const limit = parseInt(filters.limit as string) || 10;
    const skip = (page - 1) * limit;

    const pipeline: PipelineStage[] = [
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "owner",
        },
      },
      { $unwind: "$owner" },
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: "count" }],
        },
      },
    ];

    const result = await DB.Models.Property.aggregate(pipeline);
    const data = result[0]?.data || [];
    const total = result[0]?.totalCount?.[0]?.count || 0;

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Properties fetched successfully",
      data,
      pagination: {
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        perPage: limit,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getPropertyStats = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const Property = DB.Models.Property;
    const MatchedProperty = DB.Models.MatchedPreferenceProperty;

    const allProperties = await Property.find()
      .populate("owner", "userType")
      .lean()
      .exec();

    const total = allProperties.length;

    const active = allProperties.filter((p) => p.isAvailable === true);
    const inactive = allProperties.filter((p) => p.isAvailable !== true);

    // Get count of matched property records from matchedProperty model
    const totalMatches = await MatchedProperty.countDocuments();

    const recent = allProperties
      .sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 5);

    const conversion = total ? (totalMatches / total) * 100 : 0;
    const averageResponseTime = Math.floor(Math.random() * 6) + 1; // Replace with actual logic if needed

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Property dashboard stats fetched successfully",
      data: {
        total,
        active: active.length,
        inactive: inactive.length,
        totalMatches,
        recent,
        conversion: parseFloat(conversion.toFixed(2)),
        averageResponseTime,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getSinglePropertyDetails = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { propertyId } = req.params;

    const property = await DB.Models.Property.findById(propertyId)
      .populate("owner")
      .lean();

    if (!property) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Property not found",
      });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Property details fetched successfully",
      data: formatPropertyDataForTable(property),
    });
  } catch (error) {
    next(error);
  }
};

export const getPropertyInspections = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { propertyId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [inspections, total] = await Promise.all([
      DB.Models.InspectionBooking.find({ propertyId })
        .populate("owner")
        .populate("requestedBy")
        .populate("transaction")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      DB.Models.InspectionBooking.countDocuments({ propertyId }),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Property inspections fetched successfully",
      data: {
        inspections,
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        perPage: limit,
      },
    });
  } catch (error) {
    next(error);
  }
};






