import { Types } from "mongoose";
import { DB } from "../controllers";
import sendEmail from "../common/send.email";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";
import { getPropertyTitleFromLocation } from "../utils/helper";

export interface AgentSubscriberList {
  emailSubscribers: { email: string; firstName?: string | null; lastName?: string | null }[];
}

/**
 * Get all subscribers for an agent (DealSite owner).
 * Subscribers are unauthenticated guests/buyers who subscribed with email on the DealSite
 * (POST /deal-site/:publicSlug/newsletter/subscribe). No User/AgentSubscriber.
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
 * Notify all subscribers when an agent updates a property (email only).
 * Subscribers are DealSite email subscribers (unauthenticated guests/buyers).
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
 * Agent broadcasts an email to all subscribers (DealSite email subscribers only).
 */
export async function broadcastToSubscribers(
  agentUserId: Types.ObjectId,
  subject: string,
  body: string
): Promise<{ emailsSent: number }> {
  const { emailSubscribers } = await getSubscribersForAgent(agentUserId);
  let emailsSent = 0;

  for (const sub of emailSubscribers) {
    try {
      await sendEmail({
        to: sub.email,
        subject,
        html: generalEmailLayout(`
          <p>Hello ${sub.firstName || sub.lastName || "there"},</p>
          ${body}
        `),
        text: body.replace(/<[^>]*>/g, ""),
      });
      emailsSent++;
    } catch (e) {
      console.warn("[agentSubscriber] Broadcast email failed to", sub.email, e);
    }
  }

  return { emailsSent };
}
