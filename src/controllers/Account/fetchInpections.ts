import { Response, NextFunction } from "express";
import { Types } from "mongoose";
import { AppRequest } from "../../types/express";
import { DB } from "..";
import { INSPECTION_LISTING_ALLOWED_STATUSES } from "../../config/inspectionListing.config";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { formatInspectionForTable } from "../../utils/formatInspectionForTable";

/** Owner of inspection row, or agent who markets the property (main marketplace). */
async function sellerInspectionAccessFilter(user: {
  _id: Types.ObjectId;
  userType?: string;
}): Promise<Record<string, unknown>> {
  if (user.userType !== "Agent") {
    return { owner: user._id };
  }
  const marketedIds = await DB.Models.Property.find({
    $or: [{ marketedByAgentId: user._id }, { marketedByAgentIds: user._id }],
  }).distinct("_id");
  const parts: Record<string, unknown>[] = [{ owner: user._id }];
  if (marketedIds.length > 0) {
    parts.push({ propertyId: { $in: marketedIds } });
  }
  return parts.length === 1 ? parts[0] : { $or: parts };
}

export const fetchUserInspections = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      inspectionType,
      inspectionMode,
      inspectionStatus,
      stage,
      propertyId,
    } = req.query;

    const access = await sellerInspectionAccessFilter(req.user as any);
    const filter: any = {
      ...access,
      status: { $in: [...INSPECTION_LISTING_ALLOWED_STATUSES] },
    };

    if (status && INSPECTION_LISTING_ALLOWED_STATUSES.includes(status as any))
      filter.status = status;
    if (inspectionType) filter.inspectionType = inspectionType;
    if (inspectionMode) filter.inspectionMode = inspectionMode;
    if (inspectionStatus) filter.inspectionStatus = inspectionStatus;
    if (stage) filter.stage = stage;
    if (propertyId) filter.propertyId = propertyId;
 
    const inspections = await DB.Models.InspectionBooking.find(filter)
      .populate("propertyId")
      .populate("transaction")
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await DB.Models.InspectionBooking.countDocuments(filter);

    const formattedInspections = inspections.map((inspection) =>
      formatInspectionForTable(inspection),
    );

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: formattedInspections,
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

export const getOneUserInspection = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { inspectionId } = req.params;

    const access = await sellerInspectionAccessFilter(req.user as any);
    const inspection = await DB.Models.InspectionBooking.findOne({
      _id: inspectionId,
      ...access,
    })
      .populate("propertyId")
      .populate("requestedBy")
      .populate("transaction");

    if (!inspection) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: inspection,
    });
  } catch (err) {
    next(err);
  }
};

export const getInspectionStats = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const access = await sellerInspectionAccessFilter(req.user as any);

    // 🚫 Exclude unwanted statuses globally
    const excludedStatuses = ["pending_transaction", "transaction_failed"];
    const baseFilter = {
      $and: [access, { status: { $nin: excludedStatuses } }],
    };

    const [
      totalInspections,
      pendingInspections,
      completedInspections,
      cancelledInspections,
      avgResponse
    ] = await Promise.all([
      DB.Models.InspectionBooking.countDocuments(baseFilter),

      DB.Models.InspectionBooking.countDocuments({
        $and: [
          ...baseFilter.$and,
          {
            status: {
              $in: [
                "inspection_rescheduled",
                "inspection_approved",
                "active_negotiation",
                "negotiation_countered",
                "negotiation_accepted",
                "negotiation_rejected",
                "negotiation_cancelled",
              ],
            },
          },
        ],
      }),

      DB.Models.InspectionBooking.countDocuments({
        $and: [...baseFilter.$and, { status: "completed" }],
      }),

      DB.Models.InspectionBooking.countDocuments({
        $and: [...baseFilter.$and, { status: "cancelled" }],
      }),

      DB.Models.InspectionBooking.aggregate([
        { $match: baseFilter },
        {
          $project: {
            createdAt: 1,
            updatedAt: 1,
            diffInHours: {
              $divide: [
                { $subtract: ["$updatedAt", "$createdAt"] },
                1000 * 60 * 60, // milliseconds to hours
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            avgResponseTimeInHours: { $avg: "$diffInHours" },
          },
        },
      ]),
    ]);

    const averageResponseTimeInHours = avgResponse[0]?.avgResponseTimeInHours || 0;

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: {
        totalInspections,
        pendingInspections,
        completedInspections,
        cancelledInspections,
        averageResponseTimeInHours: Number(averageResponseTimeInHours.toFixed(2)),
      },
    });
  } catch (err) {
    next(err);
  }
};
