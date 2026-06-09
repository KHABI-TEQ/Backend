import { Response, NextFunction } from "express";
import { Types } from "mongoose";
import { AppRequest } from "../../types/express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { JoiValidator } from "../../validators/JoiValidator";
import {
  requestFieldAgentSchema,
  respondFieldAgentRepresentationSchema,
} from "../../validators/fieldAgentRepresentation.validator";
import {
  FIELD_AGENT_COMMISSION_ACCEPTED_MESSAGE,
  FIELD_AGENT_COMMISSION_CHECKBOX_ACK,
  FIELD_AGENT_COMMISSION_DISCLOSURE,
  FIELD_AGENT_COMMISSION_LOG_SNIPPET,
  FIELD_AGENT_COMMISSION_REQUESTED_MESSAGE_SUFFIX,
} from "../../common/constants/fieldAgentRepresentation";
import {
  assignFieldAgentUserToInspection,
  assertInspectionReadyForFieldAgent,
} from "../../services/fieldAgentAssignment.service";
import notificationService from "../../services/notification.service";
import { collectMarketedAgentUserIds } from "../../services/inspectionWorkflow.service";
import { formatInspectionForTable } from "../../utils/formatInspectionForTable";
import { InspectionLogService } from "../../services/inspectionLog.service";
import { notifyAdminsOfNewRepresentationRequest } from "../../services/fieldAgentRepresentationAlert.service";

function inspectionPropertyId(inspection: { propertyId?: unknown }): string {
  const p = inspection.propertyId as { _id?: unknown } | unknown;
  if (p && typeof p === "object" && (p as { _id?: unknown })._id) {
    return String((p as { _id: unknown })._id);
  }
  return String(p ?? "");
}

async function agentCanManageInspection(
  userId: Types.ObjectId,
  userType: string | undefined,
  inspection: { owner?: unknown; propertyId?: unknown },
): Promise<boolean> {
  const ownerMatch = String((inspection as any).owner) === String(userId);
  if (userType !== "Agent") {
    return ownerMatch;
  }
  const propRef = (inspection as any).propertyId;
  const propId = propRef?._id ?? propRef;
  const propertyDoc = await DB.Models.Property.findById(propId)
    .select("marketedByAgentId marketedByAgentIds owner")
    .lean();
  const marketedIds = collectMarketedAgentUserIds(propertyDoc || ({} as any));
  return ownerMatch || marketedIds.includes(String(userId));
}

export async function getFieldAgentRepresentationTerms(
  _req: AppRequest,
  res: Response,
) {
  return res.status(HttpStatusCodes.OK).json({
    success: true,
    data: {
      commissionDisclosure: FIELD_AGENT_COMMISSION_DISCLOSURE,
      commissionCheckboxAck: FIELD_AGENT_COMMISSION_CHECKBOX_ACK,
      paymentRequired: false,
    },
  });
}

export async function listAvailableFieldAgents(
  req: AppRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = req.user;
    if (!user || user.userType !== "Agent") {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Only Agents can browse Field Agents for representation.",
      );
    }

    const { state, localGovernment, regionOfOperation, page = "1", limit = "20" } =
      req.query as Record<string, string>;

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));
    const skip = (safePage - 1) * safeLimit;

    const userFilter: Record<string, unknown> = {
      userType: "FieldAgent",
      isDeleted: false,
      isInActive: false,
      accountApproved: true,
    };

    const pipeline: any[] = [
      { $match: userFilter },
      {
        $lookup: {
          from: "fieldagents",
          localField: "_id",
          foreignField: "userId",
          as: "fieldAgentProfile",
        },
      },
      { $unwind: { path: "$fieldAgentProfile", preserveNullAndEmptyArrays: false } },
      {
        $match: {
          "fieldAgentProfile.isFlagged": { $ne: true },
          "fieldAgentProfile.accountApproved": true,
        },
      },
    ];

    if (regionOfOperation?.trim()) {
      pipeline.push({
        $match: {
          "fieldAgentProfile.regionOfOperation": new RegExp(
            regionOfOperation.trim(),
            "i",
          ),
        },
      });
    } else if (state?.trim() || localGovernment?.trim()) {
      const regionParts = [state, localGovernment].filter(Boolean).join("|");
      pipeline.push({
        $match: {
          "fieldAgentProfile.regionOfOperation": new RegExp(regionParts, "i"),
        },
      });
    }

    pipeline.push(
      {
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          email: 1,
          phoneNumber: 1,
          profile_picture: 1,
          regionOfOperation: "$fieldAgentProfile.regionOfOperation",
          whatsappNumber: "$fieldAgentProfile.whatsappNumber",
        },
      },
      { $sort: { firstName: 1, lastName: 1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: safeLimit }],
          total: [{ $count: "count" }],
        },
      },
    );

    const agg = await DB.Models.User.aggregate(pipeline);
    const data = agg[0]?.data ?? [];
    const total = agg[0]?.total?.[0]?.count ?? 0;

    return res.status(HttpStatusCodes.OK).json({
      success: true,
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
}

export async function requestFieldAgentForInspection(
  req: AppRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.user?._id;
    const userType = req.user?.userType;
    if (!userId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
    }
    if (userType !== "Agent") {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Only Agents can request a Field Agent for an inspection.",
      );
    }

    const { inspectionId } = req.params;
    const validation = JoiValidator.validate(requestFieldAgentSchema, req.body);
    if (!validation.success || !validation.data) {
      const msg = validation.errors[0]?.message ?? "Invalid request body";
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, msg);
    }

    const { fieldAgentUserId, note } = validation.data;

    if (!Types.ObjectId.isValid(fieldAgentUserId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid field agent id");
    }

    const inspection = await DB.Models.InspectionBooking.findById(inspectionId)
      .populate("propertyId")
      .populate("transaction")
      .exec();

    if (!inspection) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found");
    }

    const allowed = await agentCanManageInspection(userId, userType, inspection);
    if (!allowed) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "You do not have permission to request a Field Agent for this inspection.",
      );
    }

    await assertInspectionReadyForFieldAgent(inspection as any);

    if (inspection.assignedFieldAgent) {
      throw new RouteError(
        HttpStatusCodes.CONFLICT,
        "This inspection already has a Field Agent assigned.",
      );
    }

    if (inspection.fieldAgentRequestStatus === "pending") {
      throw new RouteError(
        HttpStatusCodes.CONFLICT,
        "A Field Agent request is already pending for this inspection.",
      );
    }

    const fieldAgentUser = await DB.Models.User.findById(fieldAgentUserId).lean();
    if (!fieldAgentUser || fieldAgentUser.userType !== "FieldAgent") {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Field Agent not found");
    }

    const fieldAgentProfile = await DB.Models.FieldAgent.findOne({
      userId: fieldAgentUserId,
    }).lean();
    if (!fieldAgentProfile?.accountApproved || fieldAgentProfile.isFlagged) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "This Field Agent is not available for assignment.",
      );
    }

    inspection.fieldAgentRequestStatus = "pending";
    inspection.fieldAgentRequestTargetId = new Types.ObjectId(fieldAgentUserId);
    inspection.fieldAgentRequestedBy = userId;
    inspection.fieldAgentRequestNote = note?.trim() || undefined;
    inspection.fieldAgentRequestedAt = new Date();
    inspection.fieldAgentRespondedAt = undefined;
    await inspection.save();

    const propertyIdStr = inspectionPropertyId(inspection);
    if (propertyIdStr) {
      await InspectionLogService.logActivity({
        inspectionId: String(inspection._id),
        propertyId: propertyIdStr,
        senderId: String(userId),
        senderRole: "seller",
        senderModel: "User",
        message: `Agent requested Field Agent ${fieldAgentUser.firstName ?? ""} ${fieldAgentUser.lastName ?? ""} for on-site representation. ${FIELD_AGENT_COMMISSION_LOG_SNIPPET}.${note?.trim() ? ` Note: ${note.trim()}` : ""}`,
        status: inspection.status,
        stage: inspection.stage,
        meta: { fieldAgentUserId, fieldAgentRequestStatus: "pending" },
      });
    }

    const agentName = `${req.user?.firstName ?? ""} ${req.user?.lastName ?? ""}`.trim();
    await notificationService.createNotification({
      user: fieldAgentUserId,
      title: "Field Agent representation request",
      message: `${agentName || "An agent"} requested you to represent them on an inspection. ${FIELD_AGENT_COMMISSION_REQUESTED_MESSAGE_SUFFIX}`,
      type: "inspection",
      meta: { inspectionId: String(inspection._id) },
    });

    const property = inspection.propertyId as {
      briefType?: string;
      location?: { area?: string; localGovernment?: string; state?: string };
    } | null;
    const propertySummary = property
      ? `${property.briefType ?? "Property"} — ${[property.location?.area, property.location?.localGovernment, property.location?.state].filter(Boolean).join(", ")}`
      : "Property inspection";

    void notifyAdminsOfNewRepresentationRequest({
      inspectionId: String(inspection._id),
      requestingAgent: {
        firstName: req.user?.firstName,
        lastName: req.user?.lastName,
        email: req.user?.email,
      },
      targetFieldAgent: {
        firstName: fieldAgentUser.firstName,
        lastName: fieldAgentUser.lastName,
        email: fieldAgentUser.email,
      },
      propertySummary,
      inspectionDate: inspection.inspectionDate,
      note: note?.trim(),
    });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message:
        "Field Agent request sent. They will be notified to accept or reject.",
      data: {
        commissionDisclosure: FIELD_AGENT_COMMISSION_DISCLOSURE,
        fieldAgentRequestStatus: "pending",
        fieldAgentUserId,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function cancelFieldAgentRequest(
  req: AppRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.user?._id;
    const userType = req.user?.userType;
    if (!userId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
    }

    const { inspectionId } = req.params;
    const inspection = await DB.Models.InspectionBooking.findById(inspectionId).exec();
    if (!inspection) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found");
    }

    const allowed = await agentCanManageInspection(userId, userType, inspection);
    if (!allowed) {
      throw new RouteError(HttpStatusCodes.FORBIDDEN, "Not allowed to cancel this request.");
    }

    if (inspection.fieldAgentRequestStatus !== "pending") {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Only pending Field Agent requests can be cancelled.",
      );
    }

    const targetId = inspection.fieldAgentRequestTargetId?.toString();
    inspection.fieldAgentRequestStatus = "cancelled";
    inspection.fieldAgentRespondedAt = new Date();
    await inspection.save();

    const propertyIdStr = inspectionPropertyId(inspection);
    if (propertyIdStr) {
      await InspectionLogService.logActivity({
        inspectionId: String(inspection._id),
        propertyId: propertyIdStr,
        senderId: String(userId),
        senderRole: "seller",
        senderModel: "User",
        message: "Agent cancelled the pending Field Agent representation request.",
        status: inspection.status,
        stage: inspection.stage,
        meta: { fieldAgentRequestStatus: "cancelled" },
      });
    }

    if (targetId) {
      await notificationService.createNotification({
        user: targetId,
        title: "Representation request cancelled",
        message: "An agent cancelled their Field Agent representation request.",
        type: "inspection",
        meta: { inspectionId: String(inspection._id) },
      });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Field Agent request cancelled.",
    });
  } catch (err) {
    next(err);
  }
}

export async function listFieldAgentRepresentationRequests(
  req: AppRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.user?._id;
    if (!userId || req.user?.userType !== "FieldAgent") {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Only Field Agents can view representation requests.",
      );
    }

    const { page = "1", limit = "10", status = "pending" } = req.query as Record<
      string,
      string
    >;
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));

    const filter: Record<string, unknown> = {
      fieldAgentRequestTargetId: userId,
    };
    if (status === "pending") {
      filter.fieldAgentRequestStatus = "pending";
    } else if (status !== "all") {
      filter.fieldAgentRequestStatus = status;
    }

    const [rows, total] = await Promise.all([
      DB.Models.InspectionBooking.find(filter)
        .populate("propertyId")
        .populate("fieldAgentRequestedBy", "firstName lastName email phoneNumber")
        .sort({ fieldAgentRequestedAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean(),
      DB.Models.InspectionBooking.countDocuments(filter),
    ]);

    const data = rows.map((row) => formatInspectionForTable(row as any));

    return res.status(HttpStatusCodes.OK).json({
      success: true,
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
}

export async function respondToFieldAgentRepresentationRequest(
  req: AppRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.user?._id;
    if (!userId || req.user?.userType !== "FieldAgent") {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Only Field Agents can respond to representation requests.",
      );
    }

    const { inspectionId } = req.params;
    const validation = JoiValidator.validate(
      respondFieldAgentRepresentationSchema,
      req.body,
    );
    if (!validation.success || !validation.data) {
      const msg = validation.errors[0]?.message ?? "Invalid request body";
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, msg);
    }

    const { action, note } = validation.data;

    const inspection = await DB.Models.InspectionBooking.findById(inspectionId)
      .populate("transaction")
      .exec();

    if (!inspection) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found");
    }

    if (String(inspection.fieldAgentRequestTargetId) !== String(userId)) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "This representation request was not sent to you.",
      );
    }

    if (inspection.fieldAgentRequestStatus !== "pending") {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "This representation request is no longer pending.",
      );
    }

    if (action === "reject") {
      inspection.fieldAgentRequestStatus = "rejected";
      inspection.fieldAgentRespondedAt = new Date();
      if (note?.trim()) {
        inspection.fieldAgentRequestNote = [
          inspection.fieldAgentRequestNote,
          `Field Agent rejection: ${note.trim()}`,
        ]
          .filter(Boolean)
          .join("\n");
      }
      await inspection.save();

      const propertyIdStr = inspectionPropertyId(inspection);
      if (propertyIdStr) {
        await InspectionLogService.logActivity({
          inspectionId: String(inspection._id),
          propertyId: propertyIdStr,
          senderId: String(userId),
          senderRole: "seller",
          senderModel: "User",
          message: note?.trim()
            ? `Field Agent declined the representation request. Note: ${note.trim()}`
            : "Field Agent declined the representation request.",
          status: inspection.status,
          stage: inspection.stage,
          meta: { fieldAgentRequestStatus: "rejected" },
        });
      }

      const requesterId = inspection.fieldAgentRequestedBy?.toString();
      if (requesterId) {
        await notificationService.createNotification({
          user: requesterId,
          title: "Field Agent declined your request",
          message: note?.trim()
            ? `Your Field Agent request was declined. Note: ${note.trim()}`
            : "Your Field Agent request was declined.",
          type: "inspection",
          meta: { inspectionId: String(inspection._id) },
        });
      }

      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: "Representation request rejected.",
        data: { fieldAgentRequestStatus: "rejected" },
      });
    }

    await assignFieldAgentUserToInspection({
      inspectionId: String(inspection._id),
      fieldAgentUserId: String(userId),
      assignedByUserId: String(userId),
      assignedByRole: "field_agent",
      logMessage: "Field Agent accepted the representation request and was assigned.",
    });

    inspection.fieldAgentRequestStatus = "accepted";
    inspection.fieldAgentRespondedAt = new Date();
    await inspection.save();

    const requesterId = inspection.fieldAgentRequestedBy?.toString();
    if (requesterId) {
      await notificationService.createNotification({
        user: requesterId,
        title: "Field Agent accepted your request",
        message: FIELD_AGENT_COMMISSION_ACCEPTED_MESSAGE,
        type: "inspection",
        meta: { inspectionId: String(inspection._id) },
      });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Representation request accepted. You are now assigned to this inspection.",
      data: {
        fieldAgentRequestStatus: "accepted",
        assignedFieldAgent: userId,
      },
    });
  } catch (err) {
    next(err);
  }
}
