import { DB } from "../controllers";
import sendEmail from "../common/send.email";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";
import {
  transactionConfirmationRequestMail,
  transactionConfirmationFollowUpMail,
} from "../common/emailTemplates/transactionConfirmationMails";
import { buildTransactionRegistrationPageUrl } from "../common/emailTemplates/transactionReferenceIds";
import { BUYER_CONFIRM_FLOW_INSPECTION_STATUSES } from "../constants/buyerInspectionConfirmationFlow";
import { parseInspectionScheduledAt } from "../utils/inspectionSchedule";
import { InspectionLogService } from "./inspectionLog.service";
import {
  CONFIRM_TOKEN_PURPOSE_TRANSACTION,
  generateBuyerConfirmationToken,
  getBuyerConfirmationApiPath,
} from "./buyerConfirmationToken.service";
import { isLikelyE164CapableLocalPhone, runWhatsapp } from "./whatsappClient.service";

const ACCEPTED_STATUSES = [...BUYER_CONFIRM_FLOW_INSPECTION_STATUSES] as readonly string[];
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MIN_DAYS_AFTER_SLOT = 3;

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

/**
 * Buyer must have confirmed the inspection (or viewing was closed by field agent) before we ask about the transaction.
 */
function inspectionStepSatisfied(inv: any): boolean {
  return !!inv.buyerConfirmedInspectionAt || viewingClosed(inv);
}

function tryWhatsappTransactionConfirmation(buyer: any, confirmUrl: string, userName: string, propertyLabel?: string): void {
  const line = String(buyer?.whatsAppNumber || buyer?.phoneNumber || "").replace(/\s/g, "");
  if (!isLikelyE164CapableLocalPhone(line)) return;
  void runWhatsapp("buyer_transaction_confirmation", async (wa) => {
    await wa.sendMessage(line, "buyer_transaction_confirmation", {
      userName,
      confirmUrl,
    });
  });
  void import("./voiceNote.service").then(({ sendTransactionVoiceNote }) =>
    sendTransactionVoiceNote({
      phone: line,
      propertyLabel: propertyLabel || "the property",
      language: "pcm",
      event: "confirmation_request",
    })
  );
}

/**
 * Send one transaction confirmation request email using an already-populated lean inspection doc.
 */
export async function deliverTransactionConfirmationRequestToBuyer(
  inv: any,
  opts?: { devBypassInspectionStepAndSlot?: boolean }
): Promise<boolean> {
  if (!isAcceptedStatus(inv.status)) return false;
  if (inv.transactionConfirmationRequestSentAt) return false;

  const now = Date.now();
  const cutoff = now - MIN_DAYS_AFTER_SLOT * MS_PER_DAY;

  if (!opts?.devBypassInspectionStepAndSlot) {
    if (!inspectionStepSatisfied(inv)) return false;
    const slot = scheduledSlotOrFallback(new Date(inv.inspectionDate), String(inv.inspectionTime || ""));
    if (slot.getTime() > cutoff) return false;
  }

  const buyer = inv.requestedBy;
  const property = inv.propertyId;
  if (!buyer?.email || !property?._id) return false;

  const apiPath = getBuyerConfirmationApiPath();
  const token = generateBuyerConfirmationToken(String(inv._id), CONFIRM_TOKEN_PURPOSE_TRANSACTION);
  const confirmUrl = apiPath
    ? `${apiPath}/inspections/confirm-transaction?token=${encodeURIComponent(token)}`
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

  const propertyIdStr = String(property._id);
  const inspectionIdStr = String(inv._id);

  const html = generalEmailLayout(
    transactionConfirmationRequestMail({
      buyerName: buyer.fullName || buyer.email || "there",
      confirmUrl,
      inspectionDate: inspectionDateStr,
      inspectionTime: inspectionTimeStr,
      propertyId: propertyIdStr,
      inspectionId: inspectionIdStr,
    })
  );

  await sendEmail({
    to: buyer.email,
    subject: "Confirm your property transaction – Khabiteq",
    text: `Please confirm if your transaction took place by visiting: ${confirmUrl}`,
    html,
  });

  await DB.Models.InspectionBooking.updateOne(
    { _id: inv._id },
    { $set: { transactionConfirmationRequestSentAt: new Date() } }
  );

  try {
    await InspectionLogService.logActivity({
      inspectionId: String(inv._id),
      propertyId: String(property._id),
      senderId: String(buyer._id),
      senderModel: "Buyer",
      senderRole: "buyer",
      message: opts?.devBypassInspectionStepAndSlot
        ? "[Automated] Transaction confirmation request email sent to buyer (dev: shortly after inspection confirmation email)."
        : "[Automated] Transaction confirmation request email sent to buyer (3+ days after scheduled slot; inspection step satisfied).",
      status: inv.status,
      stage: inv.stage,
      meta: {
        event: "transaction_confirmation_email_sent",
        scheduledSlotAt: slot.toISOString(),
        buyerConfirmedInspectionAt: inv.buyerConfirmedInspectionAt || null,
        devBypassInspectionStepAndSlot: !!opts?.devBypassInspectionStepAndSlot,
      },
    });
  } catch (logErr) {
    console.warn("[transactionConfirmationCron] log failed:", inv._id, logErr);
  }

  const propertyLabel =
    property?.location?.street ||
    property?.location?.area ||
    (property as any)?.title ||
    "the property";

  tryWhatsappTransactionConfirmation(
    buyer,
    confirmUrl,
    buyer.fullName || buyer.email || "there",
    propertyLabel
  );

  return true;
}

export async function sendSingleTransactionConfirmationEmail(
  inspectionId: string,
  opts?: { devBypassInspectionStepAndSlot?: boolean }
): Promise<boolean> {
  const inv = await DB.Models.InspectionBooking.findById(inspectionId)
    .populate("requestedBy")
    .populate("propertyId")
    .lean();
  if (!inv) return false;
  try {
    return await deliverTransactionConfirmationRequestToBuyer(inv as any, opts);
  } catch (err) {
    console.warn("[transactionConfirmationCron] Failed to send for inspection", inspectionId, err);
    return false;
  }
}

/**
 * Run daily: 3+ full days after the agreed inspection date/time, send the transaction-only confirmation email.
 * Requires inspection step satisfied (`buyerConfirmedInspectionAt` or viewing already completed).
 * Skipped when not in production (dev uses timed sends instead).
 */
export async function sendTransactionConfirmationRequestEmails(): Promise<number> {
  if (process.env.NODE_ENV !== "production") return 0;

  const candidates = await DB.Models.InspectionBooking.find({
    status: { $in: ACCEPTED_STATUSES },
    transactionConfirmationRequestSentAt: null,
  })
    .populate("requestedBy")
    .populate("propertyId")
    .lean();

  let sent = 0;
  for (const insp of candidates) {
    try {
      if (await deliverTransactionConfirmationRequestToBuyer(insp as any)) sent++;
    } catch (err) {
      console.warn("[transactionConfirmationCron] Failed to send for inspection", (insp as any)?._id, err);
    }
  }

  return sent;
}

/**
 * Send the follow-up email (register transaction + benefits) to the buyer after they confirmed the transaction.
 */
export async function sendTransactionRegistrationFollowUpEmail(
  buyerEmail: string,
  buyerName: string,
  options?: { propertyId?: string; inspectionId?: string }
): Promise<void> {
  const clientLink = (process.env.CLIENT_LINK || "").replace(/\/$/, "");
  const registerUrl = buildTransactionRegistrationPageUrl(clientLink, {
    propertyId: options?.propertyId,
    inspectionId: options?.inspectionId,
  });

  const html = generalEmailLayout(
    transactionConfirmationFollowUpMail({
      buyerName: buyerName || "there",
      registerUrl,
      propertyId: options?.propertyId,
      inspectionId: options?.inspectionId,
    })
  );

  await sendEmail({
    to: buyerEmail,
    subject: "Register your transaction – Khabiteq",
    text: `Thank you for confirming. Please register your transaction at: ${registerUrl}`,
    html,
  });
}
