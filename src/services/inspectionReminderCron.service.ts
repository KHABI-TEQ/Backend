import { DB } from "../controllers";
import sendEmail from "../common/send.email";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";
import {
  inspectionReminderBuyerEmail,
  inspectionReminderSellerEmail,
} from "../common/emailTemplates/inspectionReminderMails";
import notificationService from "./notification.service";
import { parseInspectionScheduledAt } from "../utils/inspectionSchedule";
import { getPropertyTitleFromLocation } from "../utils/helper";

/** Inspections with a confirmed schedule worth reminding. */
const REMINDER_ELIGIBLE_STATUSES = [
  "inspection_approved",
  "inspection_rescheduled",
  "pending_transaction",
  "active_negotiation",
  "negotiation_accepted",
] as const;

/** Half-width of each reminder window (cron should run at least every 10 minutes). */
const WINDOW_MS = 10 * 60 * 1000;

function inReminderWindow(nowMs: number, scheduledMs: number, hoursBefore: number): boolean {
  const targetMs = scheduledMs - hoursBefore * 60 * 60 * 1000;
  return nowMs >= targetMs - WINDOW_MS && nowMs <= targetMs + WINDOW_MS;
}

function formatWhenLabel(scheduledAt: Date): string {
  return scheduledAt.toLocaleString("en-NG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Returns true if the schedule slot changed and reminder sent flags were cleared in DB. */
async function syncReminderSlotIfRescheduled(
  insp: {
    _id: unknown;
    inspectionDate: Date;
    inspectionTime: string;
    reminderSlotAt?: Date | null;
  },
  slot: Date
): Promise<boolean> {
  const prev = insp.reminderSlotAt ? new Date(insp.reminderSlotAt).getTime() : null;
  if (prev != null && Math.abs(prev - slot.getTime()) <= 60_000) return false;
  await DB.Models.InspectionBooking.updateOne(
    { _id: insp._id },
    {
      $set: { reminderSlotAt: slot },
      $unset: { reminder24hSentAt: "", reminder3hSentAt: "", reminder1hSentAt: "" },
    }
  );
  return true;
}

async function claimReminderSlot(
  inspectionId: unknown,
  field: "reminder24hSentAt" | "reminder3hSentAt" | "reminder1hSentAt"
): Promise<boolean> {
  const updated = await DB.Models.InspectionBooking.findOneAndUpdate(
    {
      _id: inspectionId,
      $or: [{ [field]: { $exists: false } }, { [field]: null }],
    },
    { $set: { [field]: new Date() } },
    { new: true }
  ).lean();
  return !!updated;
}

async function rollbackReminderSlot(
  inspectionId: unknown,
  field: "reminder24hSentAt" | "reminder3hSentAt" | "reminder1hSentAt"
): Promise<void> {
  await DB.Models.InspectionBooking.updateOne({ _id: inspectionId }, { $unset: { [field]: "" } });
}

async function sendReminderPair(params: {
  inspectionId: string;
  hoursBefore: 24 | 3 | 1;
  scheduledAt: Date;
  buyerEmail: string;
  buyerName: string;
  sellerEmail: string;
  sellerName: string;
  sellerUserId: string;
  ccOwnerEmail?: string;
  ccOwnerName?: string;
  ccOwnerUserId?: string;
  marketerName?: string;
  propertySummary: string;
  inspectionMode: string;
  field: "reminder24hSentAt" | "reminder3hSentAt" | "reminder1hSentAt";
}): Promise<boolean> {
  const {
    inspectionId,
    hoursBefore,
    scheduledAt,
    buyerEmail,
    buyerName,
    sellerEmail,
    sellerName,
    sellerUserId,
    ccOwnerEmail,
    ccOwnerName,
    ccOwnerUserId,
    marketerName,
    propertySummary,
    inspectionMode,
    field,
  } = params;

  const claimed = await claimReminderSlot(inspectionId, field);
  if (!claimed) return false;

  const whenLabel = formatWhenLabel(scheduledAt);
  const modeLabel = inspectionMode === "virtual" ? "Virtual" : "In person";

  try {
    const buyerHtml = generalEmailLayout(
      inspectionReminderBuyerEmail({
        name: buyerName,
        whenLabel,
        propertySummary,
        modeLabel,
        hoursBefore,
      })
    );
    await sendEmail({
      to: buyerEmail,
      subject:
        hoursBefore === 24
          ? `Reminder: inspection tomorrow — ${propertySummary}`
          : `Reminder: inspection in ${hoursBefore} hour(s) — ${propertySummary}`,
      html: buyerHtml,
      text: `Inspection reminder (${hoursBefore}h): ${propertySummary} at ${whenLabel}.`,
    });

    const sellerHtml = generalEmailLayout(
      inspectionReminderSellerEmail({
        name: sellerName,
        whenLabel,
        propertySummary,
        buyerName,
        modeLabel,
        hoursBefore,
      })
    );
    await sendEmail({
      to: sellerEmail,
      subject:
        hoursBefore === 24
          ? `Reminder: upcoming inspection tomorrow — ${propertySummary}`
          : `Reminder: inspection in ${hoursBefore} hour(s) — ${propertySummary}`,
      html: sellerHtml,
      text: `Inspection reminder (${hoursBefore}h): ${propertySummary} with ${buyerName} at ${whenLabel}.`,
    });

    await notificationService.createNotification({
      user: sellerUserId,
      title:
        hoursBefore === 24
          ? "Inspection reminder — 24 hours"
          : hoursBefore === 3
            ? "Inspection reminder — 3 hours"
            : "Inspection reminder — 1 hour",
      message: `${buyerName} — ${propertySummary} — ${whenLabel} (${modeLabel}).`,
      type: "inspection",
      meta: { inspectionId, reminderType: `${hoursBefore}h` },
    });

    if (ccOwnerEmail && ccOwnerUserId) {
      const ccName = ccOwnerName || "there";
      const sellerLabel = marketerName || sellerName;
      const ownerHtml = generalEmailLayout(`
        <p>Hello ${ccName},</p>
        <p>This is a CC reminder for an inspection on your property.</p>
        <ul>
          <li><strong>Property:</strong> ${propertySummary}</li>
          <li><strong>Buyer:</strong> ${buyerName}</li>
          <li><strong>When:</strong> ${whenLabel}</li>
          <li><strong>Mode:</strong> ${modeLabel}</li>
          <li><strong>Marketed by:</strong> ${sellerLabel}</li>
        </ul>
      `);
      await sendEmail({
        to: ccOwnerEmail,
        subject:
          hoursBefore === 24
            ? `CC reminder: upcoming inspection tomorrow — ${propertySummary}`
            : `CC reminder: inspection in ${hoursBefore} hour(s) — ${propertySummary}`,
        html: ownerHtml,
        text: `CC inspection reminder (${hoursBefore}h): ${propertySummary} with ${buyerName} at ${whenLabel}.`,
      });

      await notificationService.createNotification({
        user: ccOwnerUserId,
        title:
          hoursBefore === 24
            ? "Inspection reminder (CC) — 24 hours"
            : hoursBefore === 3
              ? "Inspection reminder (CC) — 3 hours"
              : "Inspection reminder (CC) — 1 hour",
        message: `${buyerName} — ${propertySummary} — ${whenLabel} (${modeLabel}). Marketed by ${sellerLabel}.`,
        type: "inspection",
        meta: { inspectionId, reminderType: `${hoursBefore}h`, role: "true_owner_cc" },
      });
    }
  } catch (err) {
    await rollbackReminderSlot(inspectionId, field);
    throw err;
  }
  return true;
}

/**
 * Send 24h / 3h / 1h inspection reminders (buyer: email only; seller: email + in-app).
 * Safe to run every 5–10 minutes.
 */
export async function processInspectionReminders(): Promise<{
  sent24h: number;
  sent3h: number;
  sent1h: number;
}> {
  const nowMs = Date.now();
  const lookback = new Date(nowMs - 2 * 24 * 60 * 60 * 1000);
  const lookahead = new Date(nowMs + 30 * 24 * 60 * 60 * 1000);

  const raw = await DB.Models.InspectionBooking.find({
    status: { $in: [...REMINDER_ELIGIBLE_STATUSES] },
    inspectionDate: { $gte: lookback, $lte: lookahead },
  })
    .populate("requestedBy", "email fullName")
    .populate("owner", "email firstName lastName fullName")
    .populate("propertyId", "location owner ownerModel")
    .lean();

  let sent24h = 0;
  let sent3h = 0;
  let sent1h = 0;

  for (const insp of raw as any[]) {
    try {
      const slot = parseInspectionScheduledAt(insp.inspectionDate, insp.inspectionTime);
      if (!slot) continue;

      const slotReset = await syncReminderSlotIfRescheduled(insp, slot);
      const inv = slotReset
        ? {
            ...insp,
            reminderSlotAt: slot,
            reminder24hSentAt: undefined,
            reminder3hSentAt: undefined,
            reminder1hSentAt: undefined,
          }
        : insp;

      const scheduledAt = parseInspectionScheduledAt(inv.inspectionDate, inv.inspectionTime);
      if (!scheduledAt || scheduledAt.getTime() <= nowMs) continue;

      const buyer = inv.requestedBy;
      const seller = inv.owner;
      if (!buyer?.email || !seller?.email) continue;

      const buyerName = buyer.fullName || buyer.email || "there";
      const sellerName =
        seller.fullName ||
        [seller.firstName, seller.lastName].filter(Boolean).join(" ") ||
        seller.email ||
        "there";
      const sellerUserId = String(seller._id ?? inv.owner);
      const sellerIdStr = String(seller._id ?? inv.owner);
      const propertyOwnerId =
        inv.propertyId?.owner != null ? String(inv.propertyId.owner) : "";
      let ccOwnerEmail: string | undefined;
      let ccOwnerName: string | undefined;
      let ccOwnerUserId: string | undefined;
      if (propertyOwnerId && propertyOwnerId !== sellerIdStr) {
        const trueOwner = await DB.Models.User.findById(propertyOwnerId)
          .select("email fullName firstName lastName")
          .lean();
        if (trueOwner?.email) {
          ccOwnerEmail = trueOwner.email;
          ccOwnerName =
            (trueOwner as any).fullName ||
            [(trueOwner as any).firstName, (trueOwner as any).lastName]
              .filter(Boolean)
              .join(" ") ||
            trueOwner.email;
          ccOwnerUserId = propertyOwnerId;
        }
      }
      const propertySummary =
        getPropertyTitleFromLocation(inv.propertyId?.location) || "Your property";

      const scheduledMs = scheduledAt.getTime();
      const inspectionId = String(inv._id);

      if (inReminderWindow(nowMs, scheduledMs, 24) && !inv.reminder24hSentAt) {
        const ok = await sendReminderPair({
          inspectionId,
          hoursBefore: 24,
          scheduledAt,
          buyerEmail: buyer.email,
          buyerName,
          sellerEmail: seller.email,
          sellerName,
          sellerUserId,
          ccOwnerEmail,
          ccOwnerName,
          ccOwnerUserId,
          marketerName: sellerName,
          propertySummary,
          inspectionMode: inv.inspectionMode || "in_person",
          field: "reminder24hSentAt",
        });
        if (ok) sent24h += 1;
        continue;
      }

      if (inReminderWindow(nowMs, scheduledMs, 3) && !inv.reminder3hSentAt) {
        const ok = await sendReminderPair({
          inspectionId,
          hoursBefore: 3,
          scheduledAt,
          buyerEmail: buyer.email,
          buyerName,
          sellerEmail: seller.email,
          sellerName,
          sellerUserId,
          ccOwnerEmail,
          ccOwnerName,
          ccOwnerUserId,
          marketerName: sellerName,
          propertySummary,
          inspectionMode: inv.inspectionMode || "in_person",
          field: "reminder3hSentAt",
        });
        if (ok) sent3h += 1;
        continue;
      }

      if (inReminderWindow(nowMs, scheduledMs, 1) && !inv.reminder1hSentAt) {
        const ok = await sendReminderPair({
          inspectionId,
          hoursBefore: 1,
          scheduledAt,
          buyerEmail: buyer.email,
          buyerName,
          sellerEmail: seller.email,
          sellerName,
          sellerUserId,
          ccOwnerEmail,
          ccOwnerName,
          ccOwnerUserId,
          marketerName: sellerName,
          propertySummary,
          inspectionMode: inv.inspectionMode || "in_person",
          field: "reminder1hSentAt",
        });
        if (ok) sent1h += 1;
      }
    } catch (e) {
      console.warn("[inspectionReminderCron] skip inspection", insp?._id, e);
    }
  }

  return { sent24h, sent3h, sent1h };
}
