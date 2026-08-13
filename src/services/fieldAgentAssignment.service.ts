import { Types } from "mongoose";
import { DB } from "../controllers";
import { RouteError } from "../common/classes";
import HttpStatusCodes from "../common/HttpStatusCodes";
import sendEmail from "../common/send.email";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";
import { FieldAgentAssignmentTemplate } from "../common/emailTemplates/inspectionMails";
import notificationService from "./notification.service";
import { InspectionLogService } from "./inspectionLog.service";

/** Inspection is far enough along for a field agent to be assigned or requested. */
export async function assertInspectionReadyForFieldAgent(
  inspection: {
    status?: string;
    stage?: string;
    transaction?: unknown;
    receiverMode?: { type?: string };
  },
): Promise<void> {
  if (["completed", "cancelled"].includes(String(inspection.stage ?? ""))) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Cannot assign a field agent to a completed or cancelled inspection.",
    );
  }

  const status = String(inspection.status ?? "");
  const tx = inspection.transaction as { status?: string } | null | undefined;
  const buyerPaid = tx?.status === "success";
  const dealSiteApproved =
    inspection.receiverMode?.type === "dealSite" && status === "inspection_approved";
  const approvedOrConfirmed = ["inspection_approved", "confirmed"].includes(status);

  if (!buyerPaid && !dealSiteApproved && !approvedOrConfirmed) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "The inspection must be approved (and buyer payment completed when applicable) before requesting a Field Agent.",
    );
  }
}

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

/** Assign a licensed Agent user as inspection representative (no FieldAgent profile required). */
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

export async function assignFieldAgentUserToInspection(params: {
  inspectionId: string | Types.ObjectId;
  fieldAgentUserId: string | Types.ObjectId;
  assignedByUserId?: string;
  assignedByRole?: "admin" | "system" | "field_agent";
  logMessage?: string;
}): Promise<void> {
  const inspectionId = String(params.inspectionId);
  const fieldAgentUserId = String(params.fieldAgentUserId);

  const fieldAgent = await DB.Models.FieldAgent.findOne({ userId: fieldAgentUserId })
    .populate({
      path: "userId",
      select: "firstName lastName email accountApproved isDeleted",
    })
    .exec();

  if (!fieldAgent) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Field Agent not found");
  }

  const userData = fieldAgent.userId as any;
  if (!userData?.accountApproved) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Only approved field agents can be assigned to inspections",
    );
  }

  const inspection = await DB.Models.InspectionBooking.findById(inspectionId)
    .populate("requestedBy")
    .populate("propertyId")
    .exec();

  if (!inspection) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Inspection not found");
  }

  await assertInspectionReadyForFieldAgent(inspection as any);

  if (inspection.assignedFieldAgent) {
    throw new RouteError(
      HttpStatusCodes.CONFLICT,
      inspection.assignedFieldAgent.toString() === fieldAgentUserId
        ? "This field agent is already assigned to this inspection"
        : "This inspection already has a field agent assigned",
    );
  }

  inspection.assignedFieldAgent = new Types.ObjectId(fieldAgentUserId);
  await inspection.save();

  if (!fieldAgent.assignedInspections.some((id) => String(id) === inspectionId)) {
    fieldAgent.assignedInspections.push(inspectionId);
    await fieldAgent.save();
  }

  const property = inspection.propertyId as any;
  const propertyData = {
    propertyType: property?.propertyType,
    location: property?.location,
    inspectionDate: inspection.inspectionDate,
    inspectionTime: inspection.inspectionTime,
    inspectionMode: inspection.inspectionMode,
  };

  const attachFieldAgentBody = generalEmailLayout(
    FieldAgentAssignmentTemplate(userData, propertyData),
  );

  await sendEmail({
    to: userData.email,
    subject: "New Inspection Assignment",
    html: attachFieldAgentBody,
    text: attachFieldAgentBody,
  });

  await notificationService.createNotification({
    user: fieldAgentUserId,
    title: "New Inspection Assignment",
    message: `You have been assigned to an inspection for ${property?.propertyType ?? "a property"} at ${property?.location?.area ?? ""}, ${property?.location?.localGovernment ?? ""}, ${property?.location?.state ?? ""}.`,
    meta: {
      propertyId: property?._id?.toString?.(),
      inspectionId: inspection._id.toString(),
    },
  });

  if (property?._id) {
    await InspectionLogService.logActivity({
      inspectionId,
      propertyId: String(property._id),
      senderId: params.assignedByUserId ?? fieldAgentUserId,
      senderModel: params.assignedByRole === "admin" ? "Admin" : "User",
      senderRole: params.assignedByRole === "admin" ? "admin" : "seller",
      message:
        params.logMessage ??
        `Field agent ${userData.firstName ?? ""} ${userData.lastName ?? ""} assigned to inspection.`,
      status: inspection.status,
      stage: inspection.stage,
    });
  }
}
