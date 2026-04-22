import { NextFunction, Response } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";

/**
 * GET /admin/users/:userId/properties
 * Returns properties for admin-managed user types:
 * - Agent
 * - Developer
 * - Landowners
 */
export const getAdminUserProperties = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const user = await DB.Models.User.findById(userId).lean();
    if (!user) {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "User not found"));
    }

    const allowedUserTypes = ["Agent", "Developer", "Landowners"];
    if (!allowedUserTypes.includes(user.userType)) {
      return next(
        new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          "Properties can only be fetched for Agent, Developer, or Landowners users",
        ),
      );
    }

    const propertyQuery: Record<string, unknown> = { owner: user._id };

    // Keep parity with the dedicated developer endpoint.
    if (user.userType === "Developer") {
      propertyQuery.isDeleted = { $ne: true };
    }

    const properties = await DB.Models.Property.find(propertyQuery)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();

    const total = await DB.Models.Property.countDocuments(propertyQuery);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: `${user.userType} properties fetched successfully`,
      data: properties,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};
