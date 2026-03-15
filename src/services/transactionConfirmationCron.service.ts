import jwt from "jsonwebtoken";
import { DB } from "../controllers";
import sendEmail from "../common/send.email";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";
import {
  transactionConfirmationRequestMail,
  transactionConfirmationFollowUpMail,
} from "../common/emailTemplates/transactionConfirmationMails";

const ACCEPTED_STATUSES = [
  "inspection_approved",
  "pending_transaction",
  "active_negotiation",
  "negotiation_accepted",
  "completed",
];
const DAYS_AFTER_INSPECTION = 3;
const JWT_EXPIRY = "60d";

function getConfirmBaseUrl(): string {
  return (process.env.API_BASE_URL || process.env.BACKEND_URL || "").replace(/\/$/, "");
}

function getApiPath(): string {
  const base = getConfirmBaseUrl();
  const apiPrefix = process.env.API_PREFIX || "/api";
  return base ? `${base}${apiPrefix}` : "";
}

export function generateConfirmationToken(inspectionId: string): string {
  const secret = process.env.JWT_SECRET || process.env.JWT_SECRET_ADMIN;
  if (!secret) throw new Error("JWT_SECRET or JWT_SECRET_ADMIN required for confirmation token");
  return jwt.sign({ inspectionId }, secret, { expiresIn: JWT_EXPIRY });
}

export function verifyConfirmationToken(token: string): { inspectionId: string } | null {
  try {
    const secret = process.env.JWT_SECRET || process.env.JWT_SECRET_ADMIN;
    if (!secret) return null;
    const decoded = jwt.verify(token, secret) as { inspectionId?: string };
    return decoded?.inspectionId ? { inspectionId: decoded.inspectionId } : null;
  } catch {
    return null;
  }
}

/**
 * Run daily: find inspections that were accepted and whose inspection date was exactly 3 days ago (or earlier),
 * and that haven't had the confirmation request email sent yet. Send the email and set transactionConfirmationRequestSentAt.
 */
export async function sendTransactionConfirmationRequestEmails(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const threeDaysAgoStart = new Date(today);
  threeDaysAgoStart.setDate(threeDaysAgoStart.getDate() - DAYS_AFTER_INSPECTION);
  // Inspection date must be at least 3 days ago (so we send on day 3 after inspection date).
  const dayAfterCutoff = new Date(threeDaysAgoStart.getTime() + 24 * 60 * 60 * 1000);

  const inspections = await DB.Models.InspectionBooking.find({
    status: { $in: ACCEPTED_STATUSES },
    inspectionDate: { $lt: dayAfterCutoff },
    transactionConfirmationRequestSentAt: null,
  })
    .populate("requestedBy")
    .lean();

  const apiPath = getApiPath();
  let sent = 0;

  for (const insp of inspections) {
    const buyer = insp.requestedBy as any;
    if (!buyer?.email) continue;

    try {
      const token = generateConfirmationToken(String(insp._id));
      const confirmUrl = apiPath ? `${apiPath}/inspections/confirm-transaction?token=${encodeURIComponent(token)}` : `#`;

      const inspectionDateStr = insp.inspectionDate
        ? new Date(insp.inspectionDate).toLocaleDateString("en-NG", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "the scheduled date";

      const html = generalEmailLayout(
        transactionConfirmationRequestMail({
          buyerName: buyer.fullName || buyer.email || "there",
          confirmUrl,
          inspectionDate: inspectionDateStr,
        })
      );

      await sendEmail({
        to: buyer.email,
        subject: "Confirm your property transaction – Khabiteq",
        text: `Please confirm if your transaction took place by visiting: ${confirmUrl}`,
        html,
      });

      await DB.Models.InspectionBooking.updateOne(
        { _id: insp._id },
        { $set: { transactionConfirmationRequestSentAt: new Date() } }
      );
      sent++;
    } catch (err) {
      console.warn("[transactionConfirmationCron] Failed to send for inspection", insp._id, err);
    }
  }

  return sent;
}

/**
 * Send the follow-up email (register transaction + benefits) to the buyer after they confirmed.
 */
export async function sendTransactionRegistrationFollowUpEmail(
  buyerEmail: string,
  buyerName: string
): Promise<void> {
  const clientLink = (process.env.CLIENT_LINK || "").replace(/\/$/, "");
  const registerUrl = clientLink ? `${clientLink}/transaction-registration` : "#";

  const html = generalEmailLayout(
    transactionConfirmationFollowUpMail({
      buyerName: buyerName || "there",
      registerUrl,
    })
  );

  await sendEmail({
    to: buyerEmail,
    subject: "Register your transaction – Khabiteq",
    text: `Thank you for confirming. Please register your transaction at: ${registerUrl}`,
    html,
  });
}
