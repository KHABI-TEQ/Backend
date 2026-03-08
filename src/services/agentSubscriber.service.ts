import { Types } from "mongoose";
import { DB } from "../controllers";
import sendEmail from "../common/send.email";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";
import { getPropertyTitleFromLocation } from "../utils/helper";
import { sendBulkEmail } from "./bulkEmail.service";

export interface AgentSubscriberList {
  emailSubscribers: { email: string; firstName?: string | null; lastName?: string | null }[];
}

/**
 * Get all email subscribers for the DealSite owned by this user (Agent or Developer).
 * Subscribers are unauthenticated guests/buyers who subscribed with email on the DealSite
 * (POST /deal-site/:publicSlug/newsletter/subscribe).
 */
export async function getSubscribersForAgent(agentUserId: Types.ObjectId): Promise<AgentSubscriberList> {
  const dealSite = await DB.Models.DealSite.findOne({ createdBy: agentUserId }).lean();
  const emailSubscribers: { email: string; firstName?: string | null; lastName?: string | null }[] = [];

  if (dealSite) {
    const emailSubs = await DB.Models.EmailSubscription.find({
      "receiverMode.type": "dealSite",
      "receiverMode.dealSiteID": dealSite._id,
      status: "subscribed",
    })
      .select("email firstName lastName")
      .lean();
    emailSubs.forEach((s) => {
      emailSubscribers.push({
        email: s.email,
        firstName: s.firstName ?? null,
        lastName: s.lastName ?? null,
      });
    });
  }

  return { emailSubscribers };
}

/**
 * Notify all DealSite subscribers when a property is updated (email only).
 * Subscribers are the DealSite owner's (Agent or Developer) email list.
 */
export async function notifySubscribersOfPropertyUpdate(property: {
  _id?: unknown;
  owner?: Types.ObjectId;
  location?: { state?: string; localGovernment?: string; area?: string };
  status?: string;
  [key: string]: any;
}): Promise<void> {
  if (!property.owner) return;
  const { emailSubscribers } = await getSubscribersForAgent(property.owner);
  const propertyTitle = getPropertyTitleFromLocation(property.location) || "A property";
  const message = `A property you follow has been updated: ${propertyTitle}. Status: ${property.status || "updated"}.`;

  for (const sub of emailSubscribers) {
    try {
      await sendEmail({
        to: sub.email,
        subject: `Property update: ${propertyTitle}`,
        html: generalEmailLayout(`
          <p>Hello ${sub.firstName || sub.lastName || "there"},</p>
          <p>An agent you follow has updated a listing.</p>
          <p><strong>${propertyTitle}</strong></p>
          <p>Status: ${property.status || "updated"}.</p>
          <p>Visit the agent's page to see the latest details.</p>
        `),
        text: message,
      });
    } catch (e) {
      console.warn("[agentSubscriber] Failed to send property-update email to", sub.email, e);
    }
  }
}

/**
 * Agent or Developer broadcasts an email to all their DealSite subscribers.
 * Uses bulk email provider (Resend) when RESEND_API_KEY is set for high-volume delivery;
 * otherwise falls back to SMTP (nodemailer) one-by-one.
 */
export async function broadcastToSubscribers(
  dealSiteOwnerUserId: Types.ObjectId,
  subject: string,
  body: string
): Promise<{ emailsSent: number; provider?: "resend" | "smtp" }> {
  const { emailSubscribers } = await getSubscribersForAgent(dealSiteOwnerUserId);
  if (emailSubscribers.length === 0) {
    return { emailsSent: 0 };
  }

  const recipients = emailSubscribers.map((sub) => ({
    to: sub.email,
    html: generalEmailLayout(`
      <p>Hello ${sub.firstName || sub.lastName || "there"},</p>
      ${body}
    `),
  }));

  const result = await sendBulkEmail({
    subject,
    text: body.replace(/<[^>]*>/g, ""),
    recipients,
  });

  return { emailsSent: result.emailsSent, provider: result.provider };
}
