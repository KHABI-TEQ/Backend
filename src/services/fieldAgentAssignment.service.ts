import { Types } from "mongoose";
import { DB } from "../controllers";
import { RouteError } from "../common/classes";
import HttpStatusCodes from "../common/HttpStatusCodes";
import notificationService from "./notification.service";
import { InspectionLogService } from "./inspectionLog.service";

/**
 * Property Scouts may request a licensed Agent as soon as the inspection is pending approval
 * (they cannot accept themselves), or later once approved/confirmed.
 */
export async function assertInspectionReadyForLicensedAgentRequest(
  inspection: {
    status?: string;
    stage?: string;
  },
): Promise<void> {
  if (["completed", "cancelled"].includes(String(inspection.stage ?? ""))) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Cannot request a licensed Agent for a completed or cancelled inspection.",
    );
  }
  const status = String(inspection.status ?? "");
  const ok = [
    "pending_approval",
    "pending",
    "inspection_approved",
    "confirmed",
  ].includes(status);
  if (!ok) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "This inspection is not in a state where a licensed Agent can be requested.",
    );
  }
}

/** Assign a licensed Agent user as inspection representative. */
export async function assignLicensedAgentUserToInspection(params: {
  inspectionId: string | Types.ObjectId;
  licensedAgentUserId: string | Types.ObjectId;
  assignedByUserId?: string;
  logMessage?: string;
}): Promise<void> {
  const inspectionId = String(params.inspectionId);
  const licensedAgentUserId = String(params.licensedAgentUserId);

  const userData = await DB.Models.User.findById(licensedAgentUserId)
    .select("firstName lastName email accountApproved isDeleted userType")
    .lean();
  if (!userData || userData.isDeleted || !userData.accountApproved) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Licensed Agent not found");
  }

  const inspection = await DB.Models.InspectionBooking.findById(inspectionId)
    .populate("propertyId")
    .exec();

  if (!inspection) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found");
  }

  if (inspection.assignedFieldAgent) {
    throw new RouteError(
      HttpStatusCodes.CONFLICT,
      inspection.assignedFieldAgent.toString() === licensedAgentUserId
        ? "This agent is already assigned to this inspection"
        : "This inspection already has a representing agent assigned",
    );
  }

  inspection.assignedFieldAgent = new Types.ObjectId(licensedAgentUserId);
  await inspection.save();

  const property = inspection.propertyId as any;

  await notificationService.createNotification({
    user: licensedAgentUserId,
    title: "Inspection representation assigned",
    message: `You are now representing an inspection for ${property?.propertyType ?? "a property"} at ${property?.location?.area ?? ""}, ${property?.location?.localGovernment ?? ""}, ${property?.location?.state ?? ""}.`,
    meta: {
      propertyId: property?._id?.toString?.(),
      inspectionId: inspection._id.toString(),
      representationType: "licensed_agent",
    },
  });

  if (property?._id) {
    await InspectionLogService.logActivity({
      inspectionId,
      propertyId: String(property._id),
      senderId: params.assignedByUserId ?? licensedAgentUserId,
      senderModel: "User",
      senderRole: "seller",
      message:
        params.logMessage ??
        `Licensed Agent ${userData.firstName ?? ""} ${userData.lastName ?? ""} assigned to represent this inspection.`,
      status: inspection.status,
      stage: inspection.stage,
      meta: { representationType: "licensed_agent", licensedAgentUserId },
    });
  }
}
