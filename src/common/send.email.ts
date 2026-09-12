import nodemailer from "nodemailer";
import { Resend } from "resend";
import type { InboxDeepLinkMeta } from "../utils/notificationDeepLinks";

type EmailAttachment = {
  filename: string;
  content: string | Buffer;
  contentType?: string;
};

type EmailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
  /** Set true to skip buyer in-app / push mirroring for this mail. */
  skipBuyerInbox?: boolean;
  /**
   * Structured deep-link meta mirrored into BuyerNotification + push.
   * When omitted, meta is inferred from HTML/text links and subject.
   */
  inboxMeta?: InboxDeepLinkMeta;
};

function getFromAddress(useResend: boolean): string {
  const name = process.env.FROM_NAME || "Khabiteq";
  if (useResend) {
    const resendFrom = process.env.RESEND_FROM?.trim();
    if (resendFrom) {
      return resendFrom.includes("<") ? resendFrom : `${name} <${resendFrom}>`;
    }
    const email =
      process.env.EMAIL_USER_FOR_RESEND || "notifications@khabiteq.com";
    return `${name} <${email}>`;
  }
  return `${name} <${process.env.EMAIL_USER}>`;
}

async function sendViaResend(emailOptions: EmailOptions, apiKey: string) {
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: getFromAddress(true),
    to: [emailOptions.to],
    subject: emailOptions.subject,
    text: emailOptions.text,
    html: emailOptions.html,
    attachments: emailOptions.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
    })),
  });

  if (error) {
    throw new Error(error.message || "Resend failed to send email");
  }

  return data?.id || "resend";
}

async function sendViaSmtp(emailOptions: EmailOptions) {
  const user = process.env.EMAIL_USER?.trim();
  // Gmail app passwords are 16 chars; spaces in env values often break AUTH PLAIN.
  const pass = process.env.EMAIL_PASS?.replace(/\s+/g, "").trim();

  if (!user || !pass) {
    throw new Error("SMTP credentials are not configured");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    secure: false,
    port: 587,
    auth: { user, pass },
  });

  const info = await transporter.sendMail({
    from: getFromAddress(false),
    to: emailOptions.to,
    subject: emailOptions.subject,
    text: emailOptions.text,
    html: emailOptions.html,
    attachments: emailOptions.attachments,
  });

  return info.messageId;
}

function mirrorToBuyerInbox(emailOptions: EmailOptions) {
  if (emailOptions.skipBuyerInbox) return;

  void import("../services/buyerNotification.service")
    .then(({ mirrorEmailToBuyerInbox }) =>
      mirrorEmailToBuyerInbox({
        to: emailOptions.to,
        subject: emailOptions.subject,
        text: emailOptions.text,
        html: emailOptions.html,
        meta: emailOptions.inboxMeta,
      })
    )
    .catch((err) =>
      console.warn(
        "[Email] Buyer inbox mirror failed:",
        (err as Error).message
      )
    );
}

const sendEmail = async (emailOptions: EmailOptions) => {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  try {
    const messageId = apiKey
      ? await sendViaResend(emailOptions, apiKey)
      : await sendViaSmtp(emailOptions);
    console.log(
      "Message sent via %s: %s",
      apiKey ? "resend" : "smtp",
      messageId
    );
    mirrorToBuyerInbox(emailOptions);
  } catch (error) {
    console.error("Error sending email: %s", error);
    throw error;
  }
};

export default sendEmail;
