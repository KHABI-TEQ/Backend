import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { logPropertyView } from "../../../services/propertyView.service";
import { ignoreWords } from "../../../utils/ignoreWords";

// Fetch All Properties with Filters & Pagination (Public)
export const getAllProperties = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
 
    console.log("Incoming query params:\n", JSON.stringify(req.query, null, 2));

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

    if (!briefType) {
      return res
        .status(HttpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: "briefType is required" });
    }

    const filters: any = {
      location: location || undefined,
      homeCondition: homeCondition || undefined,
      landSizeType: landSizeType || undefined,
      propertyCategory: type || undefined,
      bedroom: bedroom ? Number(bedroom) : undefined,
      bathroom: bathroom ? Number(bathroom) : undefined,
      landSize: landSize ? Number(landSize) : undefined,
      priceRange: priceRange ? JSON.parse(priceRange) : undefined,
      documentType: documentType ? documentType.split(",") : undefined,
      desireFeature: desireFeature ? desireFeature.split(",") : undefined,
      tenantCriteria: tenantCriteria ? tenantCriteria.split(",") : undefined,
    };
 
    // ✅ Pretty-print processed filters
    console.log("Processed filters:\n", JSON.stringify(filters, null, 2));

    const query: any = {
      briefType,
      isApproved: true,
      isAvailable: true,
      isDeleted: false,
    };

    if (filters.location) {
      const locationString = filters.location.trim();
      const locationParts = locationString
        .split(",")
        .map((p: string) => p.trim())
        .filter(Boolean);

      // ✅ Build flexible OR conditions for matching
      const locationQueries: Record<string, any>[] = [];

      for (const part of locationParts) {
        const lowerPart = part.toLowerCase();

        // Skip broad or generic terms
        if (ignoreWords.includes(lowerPart)) continue;

        locationQueries.push(
          { "location.state": new RegExp(part, "i") },
          { "location.localGovernment": new RegExp(part, "i") },
          { "location.area": new RegExp(part, "i") },
          { "location.streetAddress": new RegExp(part, "i") }
        );
      }

      // ✅ Attach OR query only if there’s something to match
      if (locationQueries.length > 0) {
        query.$or = [...(query.$or || []), ...locationQueries];
      }

      // console.log("📍 Processed location filters:", JSON.stringify(locationQueries, null, 2));
    }

    if (filters.homeCondition) query.homeCondition = filters.homeCondition;
    if (filters.landSizeType) query.landSizeType = filters.landSizeType;

    if (filters.propertyCategory) {
      const types = filters.propertyCategory
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean);

      if (types.length > 0) {
        query.propertyCategory = { $in: types };
      }
    }

    if (filters.bedroom) query["additionalFeatures.noOfBedroom"] = filters.bedroom;
    if (filters.bathroom) query["additionalFeatures.noOfBathroom"] = filters.bathroom;
    if (filters.landSize) query.landSize = { $gte: filters.landSize };

    if (filters.priceRange) {
      query.price = {
        $gte: filters.priceRange.min,
        $lte: filters.priceRange.max,
      };
    }

    if (filters.documentType && filters.documentType.length > 0) {
      const docs = filters.documentType.map((d: string) => {
        const normalized = d
          .trim()
          .replace(/[-_()]/g, " ")
          .replace(/\s+/g, "[-_\\s]*");

        return new RegExp(normalized, "i");
      });

      query["docOnProperty.docName"] = { $in: docs };
    }


    if (filters.desireFeature?.length) {
      const regexes = filters.desireFeature.flatMap((phrase: string) => {
        return phrase
          .split(/\s+/)
          .map((word) => new RegExp(word, "i"));
      });

      query.features = { $in: regexes };
    }

    // console.dir(query, { depth: null });

    if (filters.tenantCriteria) {
      query.tenantCriteria = { $all: filters.tenantCriteria };
    }

    // ✅ Pretty-print final MongoDB query
    // console.log("Final MongoDB query:\n", JSON.stringify(query, null, 2));

    const properties = await DB.Models.Property.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    const total = await DB.Models.Property.countDocuments(query);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: properties,
      pagination: {
        total,
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        perPage: Number(limit),
      },
    });
  } catch (err) {
    next(err);
  }
};
 

// Fetch 5 Random Approved Properties (Public)
export const getRandomProperties = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const properties = await DB.Models.Property.aggregate([
      {
        $match: {
          isApproved: true,
          isDeleted: false,
          isAvailable: true,
        },
      },
      { $sample: { size: 5 } }, // Randomly select 5
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: properties,
    });
  } catch (err) {
    next(err);
  }
};


// Fetch Single Property by ID (Public)
export const getSingleProperty = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { propertyId } = req.params;

    if (!propertyId) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Property ID is required",
      });
    }

    const property = await DB.Models.Property.findOne({
      _id: propertyId,
      isApproved: true,
      isDeleted: false,
      isAvailable: true,
    }).lean();

    if (!property) {
      return next(
        new RouteError(HttpStatusCodes.NOT_FOUND, "Property not found"),
      );
    }

    // ✅ Log the property view
    await logPropertyView({
      propertyId,
      viewerId: req.user?._id || null, // viewer is optional
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || "Unknown",
    });

    const { briefType, location } = property;

    const similarProperties = await DB.Models.Property.find({
      _id: { $ne: property._id },
      briefType,
      "location.state": location.state,
      "location.localGovernment": location.localGovernment,
      "location.area": location.area,
      isApproved: true,
      isDeleted: false,
      status: "approved",
    })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Property fetched successfully",
      data: {
        property,
        similarProperties,
      },
    });
  } catch (err) {
    next(err);
  }
};
