import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import sendEmail from "../../../common/send.email";

const USER_SELECT =
  "firstName lastName email phoneNumber accountId accountApproved accountStatus profile_picture createdAt isAccountVerified userType isInActive isFlagged isDeleted brmId brmAssignedAt";

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

async function brmCard(brmId: unknown) {
  if (!brmId) return null;
  const brm = await DB.Models.BusinessRelationManager.findById(brmId)
    .select("fullName profilePicture phoneNumber gender serviceMessage isActive")
    .lean();
  if (!brm) return null;
  return {
    id: String(brm._id),
    fullName: brm.fullName,
    profilePicture: brm.profilePicture,
    phoneNumber: brm.phoneNumber,
    gender: brm.gender,
    serviceMessage: brm.serviceMessage,
    isActive: brm.isActive,
  };
}

/**
 * @swagger
 * /admin/property-scouts:
 *   get:
 *     tags:
 *       - Admin > Property Scouts
 *     summary: Get all property scouts
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Property scouts fetched successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 */
export const listAllPropertyScouts = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const safePage = Math.max(1, Number(req.query.page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
    const skip = (safePage - 1) * safeLimit;
    const { search, excludeInactive, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    const query: Record<string, unknown> = {
      userType: "PropertyScout",
      isDeleted: { $ne: true },
    };
    if (excludeInactive !== "false") {
      query.isInActive = { $ne: true };
    }
    if (search && search.toString().trim()) {
      const regex = new RegExp(
        search.toString().trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
      query.$or = [
        { email: regex },
        { firstName: regex },
        { lastName: regex },
        { phoneNumber: regex },
        { accountId: regex },
      ];
    }

    const sortField = ALLOWED_SORT_FIELDS.has(String(sortBy)) ? String(sortBy) : "createdAt";
    const sortObj: Record<string, 1 | -1> = {};
    sortObj[sortField] = sortOrder === "asc" ? 1 : -1;

    const users = await DB.Models.User.find(query)
      .select("-password -googleId -facebookId")
      .sort(sortObj)
      .skip(skip)
      .limit(safeLimit)
      .lean();

    const userIds = users.map((user) => user._id);
    const kycByUserId = new Map<string, string>();
    if (userIds.length) {
      const profiles = await DB.Models.PublisherProfile.find({ userId: { $in: userIds } })
        .select("userId kycStatus")
        .lean();
      for (const row of profiles) {
        kycByUserId.set(String(row.userId), row.kycStatus || "none");
      }
    }

    const data = users.map((user) => ({
      ...user,
      kycStatus: kycByUserId.get(String(user._id)) || "none",
    }));
    const total = await DB.Models.User.countDocuments(query);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Property Scouts fetched successfully",
      data,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /admin/property-scouts/pending-kyc:
 *   get:
 *     tags:
 *       - Admin > Property Scouts
 *     summary: Get pending property scout KYC requests
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending property scouts fetched successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 */
export const listPendingPropertyScoutKyc = async (
  _req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const profiles = await DB.Models.PublisherProfile.find({
      userType: "PropertyScout",
      kycStatus: { $in: ["pending", "in_review"] },
    })
      .populate("userId", USER_SELECT)
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(HttpStatusCodes.OK).json({ success: true, data: profiles });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /admin/property-scouts/{userId}/kyc:
 *   get:
 *     tags:
 *       - Admin > Property Scouts
 *     summary: Get property scout KYC details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Property scout KYC fetched successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Property scout not found
 */
export const getPropertyScoutKyc = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await DB.Models.User.findById(req.params.userId).select(USER_SELECT).lean();
    if (!user || user.userType !== "PropertyScout" || user.isDeleted) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Property Scout account not found.");
    }

    const profile =
      (await DB.Models.PublisherProfile.findOne({ userId: user._id }).lean()) || {
        userId: user._id,
        userType: "PropertyScout",
        kycStatus: "none",
      };

    const brm = await brmCard(user.brmId);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: {
        user,
        profile,
        brm,
        journey: user.brmId
          ? {
              brmId: String(user.brmId),
              path: `/admin/brms/${user.brmId}/users/${user._id}/journey`,
            }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getPropertyScoutProperties = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const user = await DB.Models.User.findById(userId).select("userType isDeleted").lean();
    if (!user || user.userType !== "PropertyScout" || user.isDeleted) {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Property Scout not found"));
    }

    const filter = {
      $or: [{ owner: user._id }, { createdBy: user._id }],
      isDeleted: { $ne: true },
    };
    const [properties, total] = await Promise.all([
      DB.Models.Property.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      DB.Models.Property.countDocuments(filter),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Property Scout listings fetched successfully",
      data: properties,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /admin/property-scouts/{userId}:
 *   delete:
 *     tags:
 *       - Admin > Property Scouts
 *     summary: Delete property scout account
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Property scout account deleted successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Property scout not found
 */
export const deletePropertyScoutAccount = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body as { reason?: string };

    if (!mongoose.isValidObjectId(userId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid user id");
    }
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Reason for deletion is required.",
      });
    }

    const user = await DB.Models.User.findOneAndUpdate(
      { _id: userId, userType: "PropertyScout", isDeleted: { $ne: true } },
      {
        $set: {
          isDeleted: true,
          accountStatus: "deleted",
          isInActive: true,
          accountApproved: false,
        },
      },
      { new: true },
    ).exec();

    if (!user) {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        "Property Scout not found or already deleted.",
      );
    }

    if (user.email) {
      try {
        await sendEmail({
          to: user.email,
          subject: "Your Property Scout account has been closed",
          text: `Hello ${user.firstName || "there"}. Your Property Scout account has been closed. Reason: ${reason.trim()}`,
        });
      } catch (emailErr) {
        console.warn("[deletePropertyScoutAccount] email failed:", emailErr);
      }
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Property Scout account deleted successfully.",
    });
  } catch (err) {
    next(err);
  }
};
