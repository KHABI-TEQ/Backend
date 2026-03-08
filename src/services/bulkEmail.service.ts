import { Resend } from "resend";
import sendEmail from "../common/send.email";

const RESEND_BATCH_SIZE = 100;

function getBulkFrom(): string {
  const from = process.env.RESEND_FROM?.trim();
  if (from) return from;
  const name = process.env.FROM_NAME || "Khabiteq";
  const email = process.env.EMAIL_USER_FOR_RESEND || "notifications@khabiteq.com";
  return `${name} <${email}>`;
}

/**
 * Send the same logical message to many recipients, with optional per-recipient HTML.
 * Uses Resend batch API when RESEND_API_KEY is set (up to 100 per request, chunked);
 * otherwise falls back to existing SMTP (sendEmail) one-by-one.
 * Returns the number of emails successfully sent (best effort; Resend may report partial success).
 */
export async function sendBulkEmail(options: {
  subject: string;
  /** Plain text fallback (optional). */
  text?: string;
  /** Per-recipient: { to, html }. If not provided, single html for all is used with toList. */
  recipients?: { to: string; html: string }[];
  /** When recipients is not set, send same html/text to all these addresses. */
  toList?: string[];
  /** When using toList, this single html is sent to everyone. */
  html?: string;
}): Promise<{ emailsSent: number; provider: "resend" | "smtp" }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = getBulkFrom();

  const hasPerRecipient = options.recipients && options.recipients.length > 0;
  const toList = options.toList || (hasPerRecipient ? options.recipients!.map((r) => r.to) : []);
  const singleHtml = options.html;
  const singleText = options.text ?? (singleHtml ? singleHtml.replace(/<[^>]*>/g, "") : "");

  if (toList.length === 0 && !hasPerRecipient) {
    return { emailsSent: 0, provider: apiKey ? "resend" : "smtp" };
  }

  // Build list of { to, html, text } for each recipient
  const items: { to: string; html: string; text: string }[] = hasPerRecipient
    ? options.recipients!.map((r) => ({
        to: r.to,
        html: r.html,
        text: r.html.replace(/<[^>]*>/g, ""),
      }))
    : toList.map((to) => ({
        to,
        html: singleHtml ?? "",
        text: singleText,
      }));

  if (apiKey) {
    const resend = new Resend(apiKey);
    let emailsSent = 0;
    for (let i = 0; i < items.length; i += RESEND_BATCH_SIZE) {
      const chunk = items.slice(i, i + RESEND_BATCH_SIZE);
      const batch = chunk.map((item) => ({
        from,
        to: [item.to],
        subject: options.subject,
        html: item.html,
        text: item.text || undefined,
      }));
      const { data, error } = await resend.batch.send(batch);
      if (error) {
        console.warn("[bulkEmail] Resend batch error:", error);
      }
      const count = Array.isArray(data) ? data.length : 0;
      emailsSent += count;
    }
    return { emailsSent, provider: "resend" };
  }

  // Fallback: SMTP one-by-one (existing behavior)
  let emailsSent = 0;
  for (const item of items) {
    try {
      await sendEmail({
        to: item.to,
        subject: options.subject,
        text: item.text,
        html: item.html || undefined,
      });
      emailsSent++;
    } catch (e) {
      console.warn("[bulkEmail] SMTP failed for", item.to, e);
    }
  }
  return { emailsSent, provider: "smtp" };
}
