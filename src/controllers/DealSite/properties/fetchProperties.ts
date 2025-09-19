import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";

export const getDealSiteProperties = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { publicSlug } = req.params;
    const {
      page = "1",
      limit = "10",
      briefType,
      location,
      priceRange,
      documentType,
      bedroom,
      bathroom,
      landSizeType,
      landSize,
      desireFeature,
      homeCondition,
      tenantCriteria,
      type,
    } = req.query as Record<string, string>;

    // 1. Find DealSite
    const dealSite = await DB.Models.DealSite.findOne({ publicSlug }).lean();

    if (!dealSite) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        errorCode: "DEALSITE_NOT_FOUND",
        message: "DealSite not found",
        data: null,
      });
    }

    // 2. Ensure it's running
    if (dealSite.status !== "running") {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        errorCode: "DEALSITE_NOT_ACTIVE",
        message: "This DealSite is not currently active.",
        data: null,
      });
    }

    // 3. Build filters
    const filters: any = {
      location: location || undefined,
      homeCondition: homeCondition || undefined,
      landSizeType: landSizeType || undefined,
      type: type || undefined,
      bedroom: bedroom ? Number(bedroom) : undefined,
      bathroom: bathroom ? Number(bathroom) : undefined,
      landSize: landSize ? Number(landSize) : undefined,
      priceRange: priceRange ? JSON.parse(priceRange) : undefined,
      documentType: documentType ? documentType.split(",") : undefined,
      desireFeature: desireFeature ? desireFeature.split(",") : undefined,
      tenantCriteria: tenantCriteria ? tenantCriteria.split(",") : undefined,
    };

    // 4. Base query: properties by owner
    const query: any = {
      createdBy: dealSite.createdBy,
      isApproved: true,
      isDeleted: false,
      isAvailable: true
    };

    if (briefType) query.briefType = briefType;
    if (filters.location) query["location.state"] = filters.location;
    if (filters.homeCondition) query.propertyCondition = filters.homeCondition;
    if (filters.landSizeType) query["landSize.measurementType"] = filters.landSizeType;
    if (filters.type) query.propertyType = filters.type;
    if (filters.bedroom) query["additionalFeatures.noOfBedroom"] = filters.bedroom;
    if (filters.bathroom) query["additionalFeatures.noOfBathroom"] = filters.bathroom;
    if (filters.landSize) query["landSize.size"] = { $gte: filters.landSize };

    if (filters.priceRange) {
      query.price = {
        $gte: filters.priceRange.min,
        $lte: filters.priceRange.max,
      };
    }

    if (filters.documentType) {
      query["docOnProperty.docName"] = { $in: filters.documentType };
    }

    if (filters.desireFeature) {
      query.features = { $all: filters.desireFeature };
    }

    if (filters.tenantCriteria) {
      query.tenantCriteria = { $all: filters.tenantCriteria };
    }

    // 5. Fetch properties
    const properties = await DB.Models.Property.find(query)
      .select(
        "propertyType propertyCategory propertyCondition price location additionalFeatures pictures isAvailable status briefType isPremium isApproved",
      )
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    const total = await DB.Models.Property.countDocuments(query);

    // 6. Return response with dealSite settings
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      dealSite: {
        inspectionSettings: dealSite.inspectionSettings,
      },
      data: properties,
      pagination: {
        total,
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        perPage: Number(limit),
      }
    });
  } catch (err) {
    next(err);
  }
};
