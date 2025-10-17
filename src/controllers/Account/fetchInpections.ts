import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { formatInspectionForTable } from "../../utils/formatInspectionForTable";

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

    const filter: any = {
      owner: req.user._id,
      status: { $nin: ["pending_transaction", "transaction_failed"] },
    };

    if (status) filter.status = status;
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

    const inspection = await DB.Models.InspectionBooking.findOne({
      _id: inspectionId,
      owner: req.user._id,
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
    const userId = req.user._id;

    // 🚫 Exclude unwanted statuses globally
    const excludedStatuses = ["pending_transaction", "transaction_failed"];
    const baseFilter = {
      owner: userId,
      status: { $nin: excludedStatuses },
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
        ...baseFilter,
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
      }),

      DB.Models.InspectionBooking.countDocuments({
        ...baseFilter,
        status: "completed",
      }),

      DB.Models.InspectionBooking.countDocuments({
        ...baseFilter,
        status: "cancelled",
      }),

      DB.Models.InspectionBooking.aggregate([
        { $match: { owner: userId } },
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
