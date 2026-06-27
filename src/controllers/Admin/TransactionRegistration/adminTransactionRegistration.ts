import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { DB } from "../..";

const ALLOWED_STATUSES = ["submitted", "pending_completion", "completed", "rejected"] as const;
const ALLOWED_TYPES = ["rental_agreement", "outright_sale", "off_plan_purchase", "joint_venture"] as const;
const ALLOWED_SOURCES = ["platform_listing", "off_platform"] as const;

function buildRegistrationSourceFilter(source: string): Record<string, unknown> | null {
  if (!ALLOWED_SOURCES.includes(source as (typeof ALLOWED_SOURCES)[number])) return null;
  if (source === "platform_listing") {
    return {
      $or: [
        { registrationSource: "platform_listing" },
        {
          registrationSource: { $exists: false },
          propertyId: { $exists: true, $ne: null },
        },
      ],
    };
  }
  return {
    $or: [
      { registrationSource: "off_platform" },
      {
        registrationSource: { $exists: false },
        $or: [{ propertyId: { $exists: false } }, { propertyId: null }],
      },
    ],
  };
}

/**
 * GET /admin/transaction-registrations
 * Returns all registered transactions with details (property, inspection when present).
 * Query: page, limit, status, transactionType, registrationSource.
 */
export const getAllTransactionRegistrations = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      page = "1",
      limit = "20",
      status,
      transactionType,
      registrationSource,
    } = req.query as {
      page?: string;
      limit?: string;
      status?: string;
      transactionType?: string;
      registrationSource?: string;
    };

    const pageNum = Math.max(parseInt(page, 10), 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10), 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, any> = {};
    if (status && ALLOWED_STATUSES.includes(status as any)) {
      filter.status = status;
    }
    if (transactionType && ALLOWED_TYPES.includes(transactionType as any)) {
      filter.transactionType = transactionType;
    }
    const sourceFilter = registrationSource
      ? buildRegistrationSourceFilter(String(registrationSource))
      : null;
    if (sourceFilter) {
      Object.assign(filter, sourceFilter);
    }

    const [registrations, total] = await Promise.all([
      DB.Models.TransactionRegistration.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select("-paymentReceiptBase64 -buyerIdBase64")
        .populate("propertyId", "location price briefType propertyType status pictures additionalFeatures")
        .populate({
          path: "agentId",
          populate: { path: "userId", select: "firstName lastName email phoneNumber" },
        })
        .populate("inspectionId", "inspectionDate inspectionTime status stage")
        .lean(),

      DB.Models.TransactionRegistration.countDocuments(filter),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Transaction registrations fetched successfully",
      data: registrations,
      pagination: {
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        limit: limitNum,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /admin/transaction-registrations/stats
 * Returns counts by status and optionally by transaction type.
 */
export const getTransactionRegistrationStats = async (
  _req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const [byStatus, byType, bySource, total] = await Promise.all([
      DB.Models.TransactionRegistration.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      DB.Models.TransactionRegistration.aggregate([
        { $group: { _id: "$transactionType", count: { $sum: 1 } } },
      ]),
      DB.Models.TransactionRegistration.aggregate([
        {
          $addFields: {
            effectiveSource: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$registrationSource", null] },
                    { $ifNull: ["$registrationSource", false] },
                  ],
                },
                "$registrationSource",
                {
                  $cond: [{ $ifNull: ["$propertyId", false] }, "platform_listing", "off_platform"],
                },
              ],
            },
          },
        },
        { $group: { _id: "$effectiveSource", count: { $sum: 1 } } },
      ]),
      DB.Models.TransactionRegistration.countDocuments(),
    ]);

    const statusCounts = byStatus.reduce((acc: Record<string, number>, r: any) => {
      acc[r._id] = r.count;
      return acc;
    }, {});
    const typeCounts = byType.reduce((acc: Record<string, number>, r: any) => {
      acc[r._id] = r.count;
      return acc;
    }, {});
    const sourceCounts = bySource.reduce((acc: Record<string, number>, r: any) => {
      if (r._id) acc[r._id] = r.count;
      return acc;
    }, {});

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Transaction registration stats",
      data: {
        total,
        byStatus: statusCounts,
        byTransactionType: typeCounts,
        byRegistrationSource: sourceCounts,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /admin/transaction-registrations/:registrationId
 * Returns a single registration with full property and inspection details.
 */
export const getTransactionRegistrationById = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { registrationId } = req.params;

    const registration = await DB.Models.TransactionRegistration.findById(registrationId)
      .populate("propertyId")
      .populate({
        path: "agentId",
        populate: { path: "userId", select: "firstName lastName email phoneNumber" },
      })
      .populate("inspectionId")
      .lean();

    if (!registration) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Transaction registration not found",
        data: null,
      });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Transaction registration details",
      data: registration,
    });
  } catch (err) {
    next(err);
  }
};
