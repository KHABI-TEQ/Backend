import { DB } from "../controllers";
import sendEmail from "../common/send.email";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";
import { inspectionConfirmationRequestMail } from "../common/emailTemplates/inspectionConfirmationMails";
import { BUYER_CONFIRM_FLOW_INSPECTION_STATUSES } from "../constants/buyerInspectionConfirmationFlow";
import { parseInspectionScheduledAt } from "../utils/inspectionSchedule";
import { InspectionLogService } from "./inspectionLog.service";
import {
  CONFIRM_TOKEN_PURPOSE_INSPECTION,
  generateBuyerConfirmationToken,
  getBuyerConfirmationApiPath,
} from "./buyerConfirmationToken.service";

const ACCEPTED_STATUSES = [...BUYER_CONFIRM_FLOW_INSPECTION_STATUSES];
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MIN_DAYS_AFTER_SLOT = 1;

function scheduledSlotOrFallback(inspectionDate: Date, inspectionTime: string): Date {
  const parsed = parseInspectionScheduledAt(inspectionDate, inspectionTime);
  if (parsed) return parsed;
  const d = new Date(inspectionDate);
  d.setHours(23, 59, 59, 999);
  return d;
}

function viewingClosed(inv: { status?: string; stage?: string }): boolean {
  return inv.stage === "completed" && inv.status === "completed";
}

/**
 * Run daily: 1+ full day after the agreed inspection date/time, send a dedicated
 * "confirm inspection took place" email (separate from transaction confirmation).
 */
export async function sendInspectionConfirmationRequestEmails(): Promise<number> {
  const now = Date.now();
  const cutoff = now - MIN_DAYS_AFTER_SLOT * MS_PER_DAY;

  const candidates = await DB.Models.InspectionBooking.find({
    status: { $in: ACCEPTED_STATUSES },
    inspectionConfirmationRequestSentAt: null,
  })
    .populate("requestedBy")
    .populate("propertyId")
    .lean();

  const apiPath = getBuyerConfirmationApiPath();
  let sent = 0;

  for (const insp of candidates) {
    const inv = insp as any;
    if (viewingClosed(inv)) continue;
    if (inv.buyerConfirmedInspectionAt) continue;

    const slot = scheduledSlotOrFallback(new Date(inv.inspectionDate), String(inv.inspectionTime || ""));
    if (slot.getTime() > cutoff) continue;

    const buyer = inv.requestedBy;
    const property = inv.propertyId;
    if (!buyer?.email || !property?._id) continue;

    try {
      const token = generateBuyerConfirmationToken(String(inv._id), CONFIRM_TOKEN_PURPOSE_INSPECTION);
      const confirmUrl = apiPath
        ? `${apiPath}/inspections/confirm-inspection?token=${encodeURIComponent(token)}`
        : `#`;

      const inspectionDateStr = inv.inspectionDate
        ? new Date(inv.inspectionDate).toLocaleDateString("en-NG", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "the scheduled date";
      const inspectionTimeStr = String(inv.inspectionTime || "—");

      const html = generalEmailLayout(
        inspectionConfirmationRequestMail({
          buyerName: buyer.fullName || buyer.email || "there",
          confirmUrl,
          inspectionDate: inspectionDateStr,
          inspectionTime: inspectionTimeStr,
        })
      );

      await sendEmail({
        to: buyer.email,
        subject: "Confirm your property inspection – Khabiteq",
        text: `Please confirm your inspection took place: ${confirmUrl}`,
        html,
      });

      await DB.Models.InspectionBooking.updateOne(
        { _id: inv._id },
        { $set: { inspectionConfirmationRequestSentAt: new Date() } }
      );

      try {
        await InspectionLogService.logActivity({
          inspectionId: String(inv._id),
          propertyId: String(property._id),
          senderId: String(buyer._id),
          senderModel: "Buyer",
          senderRole: "buyer",
          message:
            "[Automated] Inspection confirmation request email sent to buyer (1+ day after scheduled slot).",
          status: inv.status,
          stage: inv.stage,
          meta: { event: "inspection_confirmation_email_sent", scheduledSlotAt: slot.toISOString() },
        });
      } catch (logErr) {
        console.warn("[inspectionConfirmationCron] log failed:", inv._id, logErr);
      }

      sent++;
    } catch (err) {
      console.warn("[inspectionConfirmationCron] Failed to send for inspection", inv._id, err);
    }
  }

  return sent;
}
