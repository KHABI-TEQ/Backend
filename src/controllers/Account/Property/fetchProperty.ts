import { Response, NextFunction } from "express";
import { Types } from "mongoose";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import {
  getPropertyPriceLock,
  userCanEditListedProperty,
} from "../../../services/propertyPriceLock.service";

/**
 * @swagger
 * /account/properties/{propertyId}/getOne:
 *   get:
 *     tags:
 *       - Account > Property
 *     summary: Get single property details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         description: Property ID
 *     responses:
 *       200:
 *         description: Property fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       403:
 *         description: You do not have permission to access this property
 *       404:
 *         description: Property not found
 */
export const fetchSingleProperty = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { propertyId } = req.params;

    const property =
      await DB.Models.Property.findById(propertyId).populate("owner");

    if (!property) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Property not found");
    }

    if (!userCanEditListedProperty(req.user._id, property, req.user.role)) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "You do not have permission to access this property",
      );
    }

    const lock = await getPropertyPriceLock(property._id);
    const data =
      typeof (property as any).toObject === "function"
        ? (property as any).toObject()
        : property;

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: {
        ...data,
        ...lock,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /account/properties/fetchAll
 * Returns the authenticated user's properties. Uses the same "owner" as request-to-market
 * (Publisher = property.owner). When no status or isApproved filter is sent, returns ALL
 * of the user's properties with no default "approved only". isDeleted excludes only
 * explicitly deleted properties (same inclusive behaviour as request-to-market list).
 */
/**
 * @swagger
 * /account/properties/fetchAll:
 *   get:
 *     tags:
 *       - Account > Property
 *     summary: Fetch all properties for authenticated user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by property status
 *       - in: query
 *         name: propertyType
 *         schema:
 *           type: string
 *         description: Filter by property type
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: Filter by state
 *       - in: query
 *         name: localGovernment
 *         schema:
 *           type: string
 *         description: Filter by local government
 *       - in: query
 *         name: priceMin
 *         schema:
 *           type: number
 *         description: Minimum price filter
 *       - in: query
 *         name: priceMax
 *         schema:
 *           type: number
 *         description: Maximum price filter
 *     responses:
 *       200:
 *         description: Properties fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *       401:
 *         description: Not authenticated
 */
export const fetchAllProperties = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
    }

    const {
      page = 1,
      limit = 10,
      status,
      propertyType,
      propertyCategory,
      state,
      localGovernment,
      area,
      priceMin,
      priceMax,
      isApproved,
    } = req.query;

    // Same "owner" as request-to-market: property.owner = Publisher (user). Use ObjectId for reliable match.
    const ownerId = Types.ObjectId.isValid(userId) ? (userId as Types.ObjectId) : new Types.ObjectId(String(userId));
    const filter: any = {
      $or: [
        { owner: ownerId },
        { marketedByAgentId: ownerId },
        { marketedByAgentIds: ownerId },
      ],
      isDeleted: { $ne: true }, // include false or undefined; only exclude explicitly deleted
    };

    // Only apply status/isApproved when explicitly sent; no default "approved only"
    if (status != null && status !== "") filter.status = status;
    if (isApproved !== undefined && isApproved !== "") filter.isApproved = isApproved === "true";

    if (propertyType) filter.propertyType = propertyType;
    if (propertyCategory) filter.propertyCategory = propertyCategory;
    if (state) filter["location.state"] = state;
    if (localGovernment) filter["location.localGovernment"] = localGovernment;
    if (area) filter["location.area"] = area;

    if (priceMin || priceMax) {
      filter.price = {};
      if (priceMin) filter.price.$gte = Number(priceMin);
      if (priceMax) filter.price.$lte = Number(priceMax);
    }

    const properties = await DB.Models.Property.find(filter)
      .populate("owner")
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await DB.Models.Property.countDocuments(filter);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: properties,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};
