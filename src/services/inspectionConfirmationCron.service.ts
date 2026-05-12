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
import { isLikelyE164CapableLocalPhone, runWhatsapp } from "./whatsappClient.service";

const ACCEPTED_STATUSES = [...BUYER_CONFIRM_FLOW_INSPECTION_STATUSES] as readonly string[];
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

function isAcceptedStatus(status: string | undefined): boolean {
  return !!status && ACCEPTED_STATUSES.includes(status);
}

function tryWhatsappInspectionConfirmation(buyer: any, confirmUrl: string, userName: string): void {
  const line = String(buyer?.whatsAppNumber || buyer?.phoneNumber || "").replace(/\s/g, "");
  if (!isLikelyE164CapableLocalPhone(line)) return;
  void runWhatsapp("buyer_inspection_confirmation", async (wa) => {
    await wa.sendMessage(line, "buyer_inspection_confirmation", {
      userName,
      confirmUrl,
    });
  });
}

/**
 * Send one inspection confirmation request email using an already-populated lean inspection doc.
 */
export async function deliverInspectionConfirmationRequestToBuyer(
  inv: any,
  opts?: { devBypassSlot?: boolean }
): Promise<boolean> {
  if (!isAcceptedStatus(inv.status)) return false;
  if (viewingClosed(inv)) return false;
  if (inv.buyerConfirmedInspectionAt) return false;
  if (inv.inspectionConfirmationRequestSentAt) return false;

  const now = Date.now();
  const cutoff = now - MIN_DAYS_AFTER_SLOT * MS_PER_DAY;

  if (!opts?.devBypassSlot) {
    const slot = scheduledSlotOrFallback(new Date(inv.inspectionDate), String(inv.inspectionTime || ""));
    if (slot.getTime() > cutoff) return false;
  }

  const buyer = inv.requestedBy;
  const property = inv.propertyId;
  if (!buyer?.email || !property?._id) return false;

  const apiPath = getBuyerConfirmationApiPath();
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
  const slot = scheduledSlotOrFallback(new Date(inv.inspectionDate), String(inv.inspectionTime || ""));

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
      message: opts?.devBypassSlot
        ? "[Automated] Inspection confirmation request email sent to buyer (dev: shortly after seller acceptance)."
        : "[Automated] Inspection confirmation request email sent to buyer (1+ day after scheduled slot).",
      status: inv.status,
      stage: inv.stage,
      meta: {
        event: "inspection_confirmation_email_sent",
        scheduledSlotAt: slot.toISOString(),
        devBypassSlot: !!opts?.devBypassSlot,
      },
    });
  } catch (logErr) {
    console.warn("[inspectionConfirmationCron] log failed:", inv._id, logErr);
  }

  tryWhatsappInspectionConfirmation(
    buyer,
    confirmUrl,
    buyer.fullName || buyer.email || "there"
  );

  return true;
}

export async function sendSingleInspectionConfirmationEmail(
  inspectionId: string,
  opts?: { devBypassSlot?: boolean }
): Promise<boolean> {
  const inv = await DB.Models.InspectionBooking.findById(inspectionId)
    .populate("requestedBy")
    .populate("propertyId")
    .lean();
  if (!inv) return false;
  try {
    return await deliverInspectionConfirmationRequestToBuyer(inv as any, opts);
  } catch (err) {
    console.warn("[inspectionConfirmationCron] Failed to send for inspection", inspectionId, err);
    return false;
  }
}

/**
 * Run daily: 1+ full day after the agreed inspection date/time, send a dedicated
 * "confirm inspection took place" email (separate from transaction confirmation).
 * Skipped when not in production (dev uses timed sends instead).
 */
export async function sendInspectionConfirmationRequestEmails(): Promise<number> {
  if (process.env.NODE_ENV !== "production") return 0;

  const candidates = await DB.Models.InspectionBooking.find({
    status: { $in: ACCEPTED_STATUSES },
    inspectionConfirmationRequestSentAt: null,
  })
    .populate("requestedBy")
    .populate("propertyId")
    .lean();

  let sent = 0;
  for (const insp of candidates) {
    try {
      if (await deliverInspectionConfirmationRequestToBuyer(insp as any)) sent++;
    } catch (err) {
      console.warn("[inspectionConfirmationCron] Failed to send for inspection", (insp as any)?._id, err);
    }
  }

  return sent;
}
