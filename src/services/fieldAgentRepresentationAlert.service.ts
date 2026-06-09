import { DB } from "../controllers";
import sendEmail from "../common/send.email";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";
import {
  fieldAgentRepresentationAdminAlert,
  fieldAgentRepresentationPendingDigest,
} from "../common/emailTemplates/fieldAgentMails";
import { SystemSettingService } from "./systemSetting.service";
import { notifyAllActiveAdmins } from "./adminNotification.service";

export interface FieldAgentRepresentationCounts {
  pending: number;
  acceptedAwaitingAssignment: number;
  totalOpen: number;
}

function adminQueueUrl(): string {
  const base = (process.env.ADMIN_CLIENT_LINK || "").replace(/\/$/, "");
  return base ? `${base}/inspections/representation-requests` : "#";
}

function inspectionAdminUrl(inspectionId: string): string {
  const base = (process.env.ADMIN_CLIENT_LINK || "").replace(/\/$/, "");
  return base
    ? `${base}/inspections/${inspectionId}?tab=field-agent`
    : "#";
}

function userLabel(u: {
  firstName?: string;
  lastName?: string;
  email?: string;
} | null | undefined): string {
  if (!u) return "—";
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return name || u.email || "—";
}

async function resolveAdminEmailRecipients(): Promise<string[]> {
  const emails = new Set<string>();
  const company = await SystemSettingService.getSetting("company_email");
  if (company?.value?.trim()) {
    emails.add(company.value.trim());
  }
  if (process.env.ADMIN_EMAIL?.trim()) {
    emails.add(process.env.ADMIN_EMAIL.trim());
  }
  return [...emails];
}

export async function getFieldAgentRepresentationCounts(): Promise<FieldAgentRepresentationCounts> {
  const [pending, acceptedAwaitingAssignment] = await Promise.all([
    DB.Models.InspectionBooking.countDocuments({
      fieldAgentRequestStatus: "pending",
    }),
    DB.Models.InspectionBooking.countDocuments({
      fieldAgentRequestStatus: "accepted",
      $or: [
        { assignedFieldAgent: { $exists: false } },
        { assignedFieldAgent: null },
      ],
    }),
  ]);

  return {
    pending,
    acceptedAwaitingAssignment,
    totalOpen: pending + acceptedAwaitingAssignment,
  };
}

export async function notifyAdminsOfNewRepresentationRequest(params: {
  inspectionId: string;
  requestingAgent: { firstName?: string; lastName?: string; email?: string };
  targetFieldAgent: { firstName?: string; lastName?: string; email?: string };
  propertySummary?: string;
  inspectionDate?: Date | string;
  note?: string;
}): Promise<void> {
  try {
    const reviewLink = inspectionAdminUrl(params.inspectionId);
    const queueLink = adminQueueUrl();
    const agentName = userLabel(params.requestingAgent);
    const fieldAgentName = userLabel(params.targetFieldAgent);

    const html = generalEmailLayout(
      fieldAgentRepresentationAdminAlert({
        agentName,
        agentEmail: params.requestingAgent.email ?? "—",
        fieldAgentName,
        fieldAgentEmail: params.targetFieldAgent.email ?? "—",
        propertySummary: params.propertySummary ?? "Property inspection",
        inspectionDate: params.inspectionDate
          ? new Date(params.inspectionDate).toLocaleString("en-US")
          : undefined,
        note: params.note,
        reviewLink,
        queueLink,
      }),
    );

    const recipients = await resolveAdminEmailRecipients();
    await Promise.all(
      recipients.map((to) =>
        sendEmail({
          to,
          subject: "New pending Field Agent representation request – Khabi-Teq",
          html,
          text: html,
        }),
      ),
    );

    void notifyAllActiveAdmins({
      type: "field_agent_representation_pending",
      title: "New Field Agent representation request",
      message: `${agentName} requested ${fieldAgentName} for on-site representation. Awaiting Field Agent response.`,
      meta: {
        inspectionId: params.inspectionId,
        fieldAgentRequestStatus: "pending",
      },
    });
  } catch (err) {
    console.warn(
      "[FieldAgentRepresentationAlert] notifyAdminsOfNewRepresentationRequest failed:",
      err,
    );
  }
}

/**
 * Daily digest: email admins when representation requests remain pending.
 */
export async function sendPendingFieldAgentRepresentationDigest(): Promise<number> {
  try {
    const pendingInspections = await DB.Models.InspectionBooking.find({
      fieldAgentRequestStatus: "pending",
    })
      .populate({
        path: "fieldAgentRequestedBy",
        model: "User",
        select: "firstName lastName email",
      })
      .populate({
        path: "fieldAgentRequestTargetId",
        model: "User",
        select: "firstName lastName email",
      })
      .populate({
        path: "propertyId",
        select: "briefType location",
      })
      .sort({ fieldAgentRequestedAt: 1 })
      .limit(50)
      .lean();

    if (!pendingInspections.length) {
      return 0;
    }

    const counts = await getFieldAgentRepresentationCounts();
    const queueLink = adminQueueUrl();

    const rows = pendingInspections.map((row) => {
      const property = row.propertyId as {
        briefType?: string;
        location?: { area?: string; localGovernment?: string };
      } | null;
      const location = property?.location
        ? [property.location.area, property.location.localGovernment]
            .filter(Boolean)
            .join(", ")
        : "—";
      return {
        inspectionId: String(row._id),
        propertyLabel: property?.briefType ?? "Property",
        location,
        agentName: userLabel(row.fieldAgentRequestedBy as any),
        fieldAgentName: userLabel(row.fieldAgentRequestTargetId as any),
        requestedAt: row.fieldAgentRequestedAt
          ? new Date(row.fieldAgentRequestedAt).toLocaleString("en-US")
          : "—",
        reviewLink: inspectionAdminUrl(String(row._id)),
      };
    });

    const html = generalEmailLayout(
      fieldAgentRepresentationPendingDigest({
        pendingCount: counts.pending,
        acceptedAwaitingAssignment: counts.acceptedAwaitingAssignment,
        queueLink,
        rows,
      }),
    );

    const recipients = await resolveAdminEmailRecipients();
    if (!recipients.length) {
      console.warn(
        "[FieldAgentRepresentationAlert] No admin email recipients configured for digest",
      );
      return 0;
    }

    await Promise.all(
      recipients.map((to) =>
        sendEmail({
          to,
          subject: `${counts.pending} pending Field Agent representation request(s) – Khabi-Teq`,
          html,
          text: html,
        }),
      ),
    );

    void notifyAllActiveAdmins({
      type: "field_agent_representation_pending",
      title: "Pending Field Agent representation requests",
      message: `${counts.pending} request(s) awaiting Field Agent response. ${counts.acceptedAwaitingAssignment} accepted but not yet assigned.`,
      meta: {
        pendingCount: counts.pending,
        acceptedAwaitingAssignment: counts.acceptedAwaitingAssignment,
      },
    });

    return pendingInspections.length;
  } catch (err) {
    console.error(
      "[FieldAgentRepresentationAlert] sendPendingFieldAgentRepresentationDigest failed:",
      err,
    );
    return 0;
  }
}
