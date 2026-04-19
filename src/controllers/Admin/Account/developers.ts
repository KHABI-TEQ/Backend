import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import sendEmail from "../../../common/send.email";
import { generalEmailLayout } from "../../../common/emailTemplates/emailLayout";
import { DeleteDeveloper } from "../../../common/emailTemplates/developerMails";

const ALLOWED_SORT_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "email",
  "firstName",
  "lastName",
  "accountStatus",
  "accountApproved",
  "isAccountVerified",
]);

/**
 * GET /admin/developers
 * Paginated developers (userType Developer) with search, filters, and sorting.
 */
export const getAllDevelopers = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const safePage = Math.max(1, Number(req.query.page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
    const skip = (safePage - 1) * safeLimit;

    const {
      search,
      isAccountVerified,
      isInActive,
      isFlagged,
      accountApproved,
      accountStatus,
      excludeInactive,
      mustChangePassword,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query: Record<string, unknown> = { userType: "Developer", isDeleted: false };
    const searchConditions: Record<string, unknown>[] = [];

    if (search && search.toString().trim()) {
      const regex = new RegExp(search.toString().trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      searchConditions.push(
        { email: regex },
        { firstName: regex },
        { lastName: regex },
        { phoneNumber: regex },
        { accountId: regex },
      );
    }

    if (searchConditions.length > 0) {
      query.$or = searchConditions;
    }

    if (isAccountVerified !== undefined) {
      query.isAccountVerified = isAccountVerified === "true";
    }
    if (isInActive !== undefined) {
      query.isInActive = isInActive === "true";
    }
    if (isFlagged !== undefined) {
      query.isFlagged = isFlagged === "true";
    }
    if (accountApproved !== undefined) {
      query.accountApproved = accountApproved === "true";
    }
    if (accountStatus && accountStatus !== "null") {
      query.accountStatus = accountStatus;
    }
    if (excludeInactive !== false && excludeInactive !== "false") {
      query.isInActive = false;
    }
    if (mustChangePassword !== undefined) {
      query.mustChangePassword = mustChangePassword === "true";
    }

    const sortField = ALLOWED_SORT_FIELDS.has(String(sortBy)) ? String(sortBy) : "createdAt";
    const sortObj: Record<string, 1 | -1> = {};
    sortObj[sortField] = sortOrder === "asc" ? 1 : -1;

    const developers = await DB.Models.User.find(query)
      .select("-password -googleId -facebookId")
      .sort(sortObj)
      .skip(skip)
      .limit(safeLimit)
      .lean();

    const total = await DB.Models.User.countDocuments(query);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Developers fetched successfully",
      data: developers,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /admin/developers/:userId
 */
export const getSingleDeveloper = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;

    const user = await DB.Models.User.findById(userId)
      .select("-password -googleId -facebookId")
      .lean();
    if (!user || user.userType !== "Developer") {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Developer not found"));
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Developer fetched successfully",
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /admin/developers/:userId/allProperties
 */
export const getAllDeveloperProperties = async (
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
    if (!user || user.userType !== "Developer") {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Developer not found"));
    }

    const properties = await DB.Models.Property.find({
      owner: user._id,
      isDeleted: { $ne: true },
    })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();

    const total = await DB.Models.Property.countDocuments({
      owner: user._id,
      isDeleted: { $ne: true },
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Developer properties fetched successfully",
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

/**
 * DELETE /admin/developers/:userId
 * Soft-deletes the developer user (same pattern as agent delete). Optional reason in body.
 */
export const deleteDeveloperAccount = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body as { reason?: string };

    if (!mongoose.isValidObjectId(userId)) {
      return next(new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid user id"));
    }

    const user = await DB.Models.User.findOneAndUpdate(
      { _id: userId, userType: "Developer", isDeleted: { $ne: true } },
      {
        $set: {
          isDeleted: true,
          accountStatus: "deleted",
          isInActive: true,
          accountApproved: false,
        },
      },
      { new: true }
    ).exec();

    if (!user) {
      return next(
        new RouteError(
          HttpStatusCodes.NOT_FOUND,
          "Developer not found or already deleted."
        )
      );
    }

    await DB.Models.DealSite.updateMany(
      { createdBy: user._id },
      { $set: { status: "deleted" } }
    ).exec();

    const mailBody = generalEmailLayout(
      DeleteDeveloper(
        user.firstName || user.lastName || user.email,
        reason
      )
    );

    try {
      await sendEmail({
        to: user.email,
        subject: "Developer account closed",
        text: mailBody,
        html: mailBody,
      });
    } catch (emailErr) {
      console.warn("[deleteDeveloperAccount] email failed:", emailErr);
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Developer account deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};
