import { Response, NextFunction } from "express";
import { Types } from "mongoose";
import { AppRequest } from "../../types/express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { JoiValidator } from "../../validators/JoiValidator";
import {
  requestFieldAgentSchema,
} from "../../validators/fieldAgentRepresentation.validator";
import {
  assertInspectionReadyForLicensedAgentRequest,
  assignLicensedAgentUserToInspection,
} from "../../services/fieldAgentAssignment.service";
import notificationService from "../../services/notification.service";
import { collectMarketedAgentUserIds } from "../../services/inspectionWorkflow.service";
import { InspectionLogService } from "../../services/inspectionLog.service";
import {
  assertUserIsLicensedAgent,
  listLicensedPublishers,
} from "../../services/licensedAgents.service";
import {
  getPropertyScoutSnapshot,
  isPropertyScout,
} from "../../services/propertyScout.service";

const LICENSED_AGENT_REQUEST_DISCLOSURE =
  "By requesting a licensed Agent, you ask them to handle this inspection on your behalf. They may contact the buyer and manage site access. Agree only if you understand and accept their professional representation.";

const LICENSED_AGENT_REQUEST_CHECKBOX =
  "I understand I am requesting a licensed Agent to represent this inspection.";

function inspectionPropertyId(inspection: { propertyId?: unknown }): string {
  const p = inspection.propertyId as { _id?: unknown } | unknown;
  if (p && typeof p === "object" && (p as { _id?: unknown })._id) {
    return String((p as { _id: unknown })._id);
  }
  return String(p ?? "");
}

async function publisherCanManageInspection(
  userId: Types.ObjectId,
  userType: string | undefined,
  inspection: { owner?: unknown; propertyId?: unknown }
): Promise<boolean> {
  const ownerMatch = String((inspection as any).owner) === String(userId);
  if (userType !== "Agent" && userType !== "Developer") {
    return ownerMatch;
  }
  if (userType === "Developer") return ownerMatch;
  const propRef = (inspection as any).propertyId;
  const propId = propRef?._id ?? propRef;
  const propertyDoc = await DB.Models.Property.findById(propId)
    .select("marketedByAgentId marketedByAgentIds owner")
    .lean();
  const marketedIds = collectMarketedAgentUserIds(propertyDoc || ({} as any));
  return ownerMatch || marketedIds.includes(String(userId));
}

export async function getLicensedAgentRepresentationTerms(
  _req: AppRequest,
  res: Response
) {
  return res.status(HttpStatusCodes.OK).json({
    success: true,
    data: {
      commissionDisclosure: LICENSED_AGENT_REQUEST_DISCLOSURE,
      commissionCheckboxAck: LICENSED_AGENT_REQUEST_CHECKBOX,
      paymentRequired: false,
      replacesFieldAgentRequest: true,
    },
  });
}

/** Auth: Property Scouts (and publishers) browse licensed Agents — no contact fields. */
export async function listAvailableLicensedAgents(
  req: AppRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = req.user;
    if (!user?._id) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
    }
    if (user.userType !== "Agent" && user.userType !== "Developer") {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Only Agents and Developers can browse licensed Agents."
      );
    }

    const { state, localGovernment, search, page = "1", limit = "20" } =
      req.query as Record<string, string>;

    const result = await listLicensedPublishers({
      state,
      localGovernment,
      search,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      userTypes: ["Agent"],
    });

    // Never return the requester themselves
    const data = result.data.filter((a) => a._id !== String(user._id));

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
}

/** Public buyer directory — licensed Agents only, no contact info. */
export async function listPublicLicensedAgentsDirectory(
  req: AppRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { state, localGovernment, search, page = "1", limit = "20" } =
      req.query as Record<string, string>;

    const result = await listLicensedPublishers({
      state,
      localGovernment,
      search,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      userTypes: ["Agent"],
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: result.data,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Property Scout requests a licensed Agent to handle an inspection.
 * Reuses fieldAgentRequest* inspection fields (representation target = licensed Agent user).
 */
export async function requestLicensedAgentForInspection(
  req: AppRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?._id;
    const userType = req.user?.userType;
    if (!userId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
    }
    if (userType !== "Agent" && userType !== "Developer") {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Only Agents and Developers can request a licensed Agent."
      );
    }

    if (!(await isPropertyScout(String(userId)))) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Only Property Scouts (no license on approved KYC, or KYC not yet submitted) can request a licensed Agent for inspections. Licensed Agents handle inspections directly."
      );
    }

    const { inspectionId } = req.params;
    const validation = JoiValidator.validate(requestFieldAgentSchema, {
      ...req.body,
      fieldAgentUserId:
        req.body?.licensedAgentUserId || req.body?.fieldAgentUserId,
      acknowledgedCommissionTerms:
        req.body?.acknowledgedCommissionTerms ?? true,
    });
    if (!validation.success || !validation.data) {
      const msg = validation.errors[0]?.message ?? "Invalid request body";
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, msg);
    }

    const licensedAgentUserId = validation.data.fieldAgentUserId;
    const note = validation.data.note;

    if (!Types.ObjectId.isValid(licensedAgentUserId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid agent id");
    }

    const inspection = await DB.Models.InspectionBooking.findById(inspectionId)
      .populate("propertyId")
      .populate("transaction")
      .exec();

    if (!inspection) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found");
    }

    const allowed = await publisherCanManageInspection(
      userId,
      userType,
      inspection
    );
    if (!allowed) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "You do not have permission to request a licensed Agent for this inspection."
      );
    }

    await assertInspectionReadyForLicensedAgentRequest(inspection as any);

    if (inspection.assignedFieldAgent) {
      throw new RouteError(
        HttpStatusCodes.CONFLICT,
        "This inspection already has a representing agent assigned."
      );
    }

    if (inspection.fieldAgentRequestStatus === "pending") {
      throw new RouteError(
        HttpStatusCodes.CONFLICT,
        "A representation request is already pending for this inspection."
      );
    }

    try {
      await assertUserIsLicensedAgent(licensedAgentUserId);
    } catch {
      throw new RouteError(
        HttpStatusCodes.NOT_FOUND,
        "Licensed Agent not found or not eligible."
      );
    }

    if (String(licensedAgentUserId) === String(userId)) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "You cannot request yourself."
      );
    }

    inspection.fieldAgentRequestStatus = "pending";
    inspection.fieldAgentRequestTargetId = new Types.ObjectId(
      licensedAgentUserId
    );
    inspection.fieldAgentRequestedBy = userId;
    inspection.fieldAgentRequestNote = note?.trim() || undefined;
    inspection.fieldAgentRequestedAt = new Date();
    inspection.fieldAgentRespondedAt = undefined;
    await inspection.save();

    const propertyIdStr = inspectionPropertyId(inspection);
    const target = await DB.Models.User.findById(licensedAgentUserId)
      .select("firstName lastName")
      .lean();
    if (propertyIdStr) {
      await InspectionLogService.logActivity({
        inspectionId: String(inspection._id),
        propertyId: propertyIdStr,
        senderId: String(userId),
        senderRole: "seller",
        senderModel: "User",
        message: `Property Scout requested licensed Agent ${target?.firstName ?? ""} ${target?.lastName ?? ""} for inspection representation.${note?.trim() ? ` Note: ${note.trim()}` : ""}`,
        status: inspection.status,
        stage: inspection.stage,
        meta: {
          licensedAgentUserId,
          fieldAgentRequestStatus: "pending",
          representationType: "licensed_agent",
        },
      });
    }

    const scoutName =
      `${req.user?.firstName ?? ""} ${req.user?.lastName ?? ""}`.trim() ||
      "A Property Scout";
    await notificationService.createNotification({
      user: licensedAgentUserId,
      title: "Licensed Agent representation request",
      message: `${scoutName} requested you to handle an inspection on their behalf.`,
      type: "inspection",
      meta: {
        inspectionId: String(inspection._id),
        representationType: "licensed_agent",
      },
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Licensed Agent representation request sent.",
      data: {
        inspectionId: String(inspection._id),
        fieldAgentRequestStatus: inspection.fieldAgentRequestStatus,
        licensedAgentUserId,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function respondLicensedAgentRepresentation(
  req: AppRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?._id;
    if (!userId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
    }
    try {
      await assertUserIsLicensedAgent(userId);
    } catch {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Only licensed Agents can respond to representation requests."
      );
    }

    const { inspectionId } = req.params;
    const action = String(req.body?.action || "").toLowerCase();
    if (action !== "accept" && action !== "reject") {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "action must be accept or reject"
      );
    }

    const inspection = await DB.Models.InspectionBooking.findById(inspectionId);
    if (!inspection) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found");
    }

    if (
      inspection.fieldAgentRequestStatus !== "pending" ||
      String(inspection.fieldAgentRequestTargetId) !== String(userId)
    ) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "No pending representation request for you on this inspection."
      );
    }

    if (action === "reject") {
      inspection.fieldAgentRequestStatus = "rejected";
      inspection.fieldAgentRespondedAt = new Date();
      await inspection.save();
      if (inspection.fieldAgentRequestedBy) {
        await notificationService.createNotification({
          user: String(inspection.fieldAgentRequestedBy),
          title: "Licensed Agent declined",
          message: "Your licensed Agent representation request was declined.",
          type: "inspection",
          meta: { inspectionId: String(inspection._id) },
        });
      }
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: "Representation request declined.",
      });
    }

    await assignLicensedAgentUserToInspection({
      inspectionId: String(inspection._id),
      licensedAgentUserId: String(userId),
      assignedByUserId: String(userId),
      logMessage: "Licensed Agent accepted Property Scout representation request.",
    });

    const updated = await DB.Models.InspectionBooking.findById(inspectionId);
    if (updated) {
      updated.fieldAgentRequestStatus = "accepted";
      updated.fieldAgentRespondedAt = new Date();
      await updated.save();
    }

    if (inspection.fieldAgentRequestedBy) {
      await notificationService.createNotification({
        user: String(inspection.fieldAgentRequestedBy),
        title: "Licensed Agent accepted",
        message:
          "A licensed Agent accepted your request and will handle the inspection.",
        type: "inspection",
        meta: { inspectionId: String(inspection._id) },
      });
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "You are now representing this inspection.",
    });
  } catch (err) {
    next(err);
  }
}

export async function getMyPropertyScoutStatus(
  req: AppRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?._id;
    if (!userId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
    }
    const snapshot = await getPropertyScoutSnapshot(String(userId));
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: snapshot,
    });
  } catch (err) {
    next(err);
  }
}

/** Licensed Agents: pending Property Scout representation requests. */
export async function listLicensedAgentRepresentationRequests(
  req: AppRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?._id;
    if (!userId) {
      throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
    }
    try {
      await assertUserIsLicensedAgent(userId);
    } catch {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "Only licensed Agents can view representation requests."
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
        .populate("fieldAgentRequestedBy", "firstName lastName")
        .sort({ fieldAgentRequestedAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean(),
      DB.Models.InspectionBooking.countDocuments(filter),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: rows.map((row: any) => ({
        id: String(row._id),
        _id: String(row._id),
        status: row.status,
        inspectionDate: row.inspectionDate,
        inspectionTime: row.inspectionTime,
        fieldAgentRequestNote: row.fieldAgentRequestNote,
        fieldAgentRequestedAt: row.fieldAgentRequestedAt,
        fieldAgentRequestedBy: row.fieldAgentRequestedBy,
        property: row.propertyId,
        propertyId: row.propertyId,
      })),
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
