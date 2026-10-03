import { Response, NextFunction } from "express";
import { Types } from "mongoose";
import { AppRequest } from "../../types/express";
import { DB } from "..";
import { INSPECTION_LISTING_ALLOWED_STATUSES } from "../../config/inspectionListing.config";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { formatInspectionForTable } from "../../utils/formatInspectionForTable";
import { buildKycNotice } from "../../services/kycNotice.service";
import { getPractitionerKycStatus } from "../../services/publisherKyc.service";

const EMPTY_INSPECTION_MESSAGE = "No matched inspection requests found";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const STATUS_SEARCH: Record<string, string[]> = {
  pending: ["pending_approval", "pending_transaction"],
  completed: ["completed"],
  complete: ["completed"],
  cancelled: ["agent_rejected", "cancelled"],
  canceled: ["agent_rejected", "cancelled"],
  rejected: ["agent_rejected"],
  approved: ["inspection_approved"],
  rescheduled: ["inspection_rescheduled"],
};

async function inspectionKycOverlay(userId: unknown) {
  const [kycStatus, user] = await Promise.all([
    getPractitionerKycStatus(String(userId)),
    DB.Models.User.findById(userId).select("kycNoticeDismissedStatus").lean(),
  ]);
  return buildKycNotice({
    kycStatus,
    dismissedStatus: user?.kycNoticeDismissedStatus,
  });
}

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

/**
 * @swagger
 * /account/my-inspections/fetchAll:
 *   get:
 *     tags:
 *       - Account > Inspections
 *     summary: Fetch user's inspections with pagination
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
 *         description: Filter by inspection status
 *       - in: query
 *         name: inspectionType
 *         schema:
 *           type: string
 *         description: Filter by inspection type
 *       - in: query
 *         name: propertyId
 *         schema:
 *           type: string
 *         description: Filter by property ID
 *     responses:
 *       200:
 *         description: Inspections fetched successfully
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
 *                   properties:
 *                     total:
 *                       type: number
 *                     page:
 *                       type: number
 *                     limit:
 *                       type: number
 *                     totalPages:
 *                       type: number
 */
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
      keyword,
      search,
    } = req.query;

    const access = await sellerInspectionAccessFilter(req.user as any);
    const andParts: Record<string, unknown>[] = [
      access,
      { status: { $in: [...INSPECTION_LISTING_ALLOWED_STATUSES] } },
    ];

    if (status && INSPECTION_LISTING_ALLOWED_STATUSES.includes(status as any)) {
      andParts[1] = { status };
    }
    if (inspectionType) andParts.push({ inspectionType });
    if (inspectionMode) andParts.push({ inspectionMode });
    if (inspectionStatus) andParts.push({ inspectionStatus });
    if (stage) andParts.push({ stage });
    if (propertyId) andParts.push({ propertyId });

    const searchText = String(keyword || search || "").trim();
    if (searchText) {
      const regex = new RegExp(escapeRegex(searchText), "i");
      const propertyIds = await DB.Models.Property.find({
        $or: [
          { propertyType: regex },
          { briefType: regex },
          { "location.area": regex },
          { "location.state": regex },
          { "location.localGovernment": regex },
          { "location.streetAddress": regex },
        ],
      }).distinct("_id");
      const statusKey = searchText.toLowerCase();
      const statusMatches = STATUS_SEARCH[statusKey] ||
        INSPECTION_LISTING_ALLOWED_STATUSES.filter((item) => item.includes(statusKey));
      andParts.push({
        $or: [
          { propertyId: { $in: propertyIds } },
          { status: regex },
          { inspectionType: regex },
          ...(statusMatches.length ? [{ status: { $in: statusMatches } }] : []),
        ],
      });
    }

    const filter = { $and: andParts };
 
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

    const pageNumber = Number(page);
    const pageLimit = Number(limit);
    const totalPages = Math.ceil(total / pageLimit) || 1;
    const rangeStart = total === 0 ? 0 : (pageNumber - 1) * pageLimit + 1;
    const rangeEnd = Math.min(pageNumber * pageLimit, total);
    const kycOverlay = await inspectionKycOverlay(req.user?._id);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Monitor and manage all your property inspection and booking requests in one place",
      data: formattedInspections,
      emptyMessage: total === 0 ? EMPTY_INSPECTION_MESSAGE : null,
      rangeLabel:
        total === 0
          ? "0 of 0 inspections"
          : `${rangeStart}-${rangeEnd} of ${total} inspections`,
      kycOverlay,
      kycNotice: kycOverlay,
      pagination: {
        total,
        page: pageNumber,
        limit: pageLimit,
        totalPages,
        pageLabel: `Page ${pageNumber} of ${totalPages}`,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /account/my-inspections/{inspectionId}:
 *   get:
 *     tags:
 *       - Account > Inspections
 *     summary: Get single inspection details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inspectionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Inspection ID
 *     responses:
 *       200:
 *         description: Inspection fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       404:
 *         description: Inspection not found
 */
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

    const kycOverlay = await inspectionKycOverlay(req.user?._id);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: inspection,
      kycOverlay,
      kycNotice: kycOverlay,
      canRespond: kycOverlay.completed === true,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /account/my-inspections/stats:
 *   get:
 *     tags:
 *       - Account > Inspections
 *     summary: Get inspection statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Inspection stats fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalInspections:
 *                       type: number
 *                     pendingInspections:
 *                       type: number
 *                     completedInspections:
 *                       type: number
 *                     cancelledInspections:
 *                       type: number
 *                     averageResponseTimeInHours:
 *                       type: number
 */
export const getInspectionStats = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const access = await sellerInspectionAccessFilter(req.user as any);

    const baseFilter = {
      $and: [access, { status: { $in: [...INSPECTION_LISTING_ALLOWED_STATUSES] } }],
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
                "pending_approval",
                "pending_transaction",
                "inspection_rescheduled",
                "inspection_approved",
              ],
            },
          },
        ],
      }),

      DB.Models.InspectionBooking.countDocuments({
        $and: [...baseFilter.$and, { status: "completed" }],
      }),

      DB.Models.InspectionBooking.countDocuments({
        $and: [...baseFilter.$and, { status: { $in: ["cancelled", "agent_rejected"] } }],
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

    const averageResponseTimeInHours = Number(
      (avgResponse[0]?.avgResponseTimeInHours || 0).toFixed(1)
    );
    const avgResponseLabel = `${averageResponseTimeInHours.toFixed(1)}h`;
    const kycOverlay = await inspectionKycOverlay(req.user?._id);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: {
        title: "My Inspection",
        subtitle:
          "Monitor and manage all your property inspection and booking requests in one place",
        total: totalInspections,
        pending: pendingInspections,
        completed: completedInspections,
        cancelled: cancelledInspections,
        avgResponse: avgResponseLabel,
        totalInspections,
        pendingInspections,
        completedInspections,
        cancelledInspections,
        averageResponseTimeInHours,
        cards: [
          { key: "total", label: "Total", value: totalInspections },
          { key: "pending", label: "Pending", value: pendingInspections },
          { key: "completed", label: "Completed", value: completedInspections },
          { key: "cancelled", label: "Cancelled", value: cancelledInspections },
          { key: "avgResponse", label: "Avg Response", value: avgResponseLabel },
        ],
        kycOverlay,
        kycNotice: kycOverlay,
      },
    });
  } catch (err) {
    next(err);
  }
};
