import sendEmail from "../common/send.email";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";

/**
 * Email to Publisher (Landlord/Developer): an Agent has requested to market their LASRERA Market Place property.
 * Includes Agent's public access page URL and contact details so the Publisher can verify the Agent.
 */
export async function notifyPublisherOfRequestToMarket(params: {
  publisherEmail: string;
  publisherName: string;
  agentName: string;
  agentEmail?: string;
  agentPhone?: string;
  /** Agent's public access page (DealSite) URL for verification. */
  agentPublicPageUrl?: string;
  propertySummary: string;
  respondUrl: string;
  agentCommissionAmount: number;
}): Promise<void> {
  const {
    publisherEmail,
    publisherName,
    agentName,
    agentEmail,
    agentPhone,
    agentPublicPageUrl,
    propertySummary,
    respondUrl,
    agentCommissionAmount,
  } = params;

  const contactLines: string[] = [];
  if (agentEmail) contactLines.push(`<strong>Email:</strong> ${agentEmail}`);
  if (agentPhone) contactLines.push(`<strong>Phone:</strong> ${agentPhone}`);
  const contactBlock =
    contactLines.length > 0
      ? `<p><strong>Agent contact details (for verification):</strong></p><ul>${contactLines.map((l) => `<li>${l}</li>`).join("")}</ul>`
      : "";

  const publicPageBlock = agentPublicPageUrl
    ? `<p>You can verify this agent by visiting their public access page:</p><p><a href="${agentPublicPageUrl}" style="color:#09391C;">${agentPublicPageUrl}</a></p>`
    : "";

  const html = generalEmailLayout(`
    <p>Hello ${publisherName || "there"},</p>
    <p><strong>${agentName}</strong> has requested to market your KHABITEQ Market Place property.</p>
    <p>Property: <strong>${propertySummary}</strong></p>
    ${publicPageBlock}
    ${contactBlock}
    <p>If you accept, the property will appear on the agent's public page and you will pay an agent commission of <strong>₦${agentCommissionAmount.toLocaleString()}</strong> to the agent.</p>
    <p>Please accept or reject this request from your dashboard.</p>
    <p><a href="${respondUrl}" style="display:inline-block;background:#09391C;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;">View and respond</a></p>
  `);

  const textParts = [
    `${agentName} has requested to market your property. ${propertySummary}.`,
    agentPublicPageUrl ? `Verify the agent: ${agentPublicPageUrl}` : "",
    agentEmail ? `Agent email: ${agentEmail}` : "",
    agentPhone ? `Agent phone: ${agentPhone}` : "",
    `Respond at: ${respondUrl}`,
  ].filter(Boolean);
  await sendEmail({
    to: publisherEmail,
    subject: "Request To Market – action required",
    html,
    text: textParts.join("\n"),
  });
}

/**
 * Email to Agent: Publisher rejected their Request To Market.
 */
export async function notifyAgentRequestToMarketRejected(params: {
  agentEmail: string;
  agentName: string;
  propertySummary: string;
  rejectedReason?: string;
}): Promise<void> {
  const { agentEmail, agentName, propertySummary, rejectedReason } = params;
  const reasonLine = rejectedReason
    ? `<p>Reason provided: ${rejectedReason}</p>`
    : "";
  const html = generalEmailLayout(`
    <p>Hello ${agentName || "there"},</p>
    <p>Your request to market the property at <strong>${propertySummary}</strong> was declined by the publisher.</p>
    ${reasonLine}
    <p>You can request to market other properties from the KHABITEQ Market Place.</p>
  `);
  await sendEmail({
    to: agentEmail,
    subject: "Request To Market declined",
    html,
    text: `Your request to market ${propertySummary} was declined.${rejectedReason ? ` Reason: ${rejectedReason}` : ""}`,
  });
}

/**
 * Email to Agent: Publisher accepted their Request To Market; property is now on their public page.
 * Includes Publisher (Developer/Landlord) name and contact so the Agent can reach them.
 */
export async function notifyAgentRequestToMarketAccepted(params: {
  agentEmail: string;
  agentName: string;
  propertySummary: string;
  publisherName?: string;
  publisherEmail?: string;
  publisherPhone?: string;
}): Promise<void> {
  const { agentEmail, agentName, propertySummary, publisherName, publisherEmail, publisherPhone } = params;
  const contactLines: string[] = [];
  if (publisherEmail) contactLines.push(`<strong>Email:</strong> ${publisherEmail}`);
  if (publisherPhone) contactLines.push(`<strong>Phone:</strong> ${publisherPhone}`);
  const contactBlock =
    (publisherName || contactLines.length > 0)
      ? `<p><strong>Publisher details</strong> (you can contact them to coordinate):</p><p>${publisherName ? `Name: <strong>${publisherName}</strong>` : ""}</p>${contactLines.length > 0 ? `<ul>${contactLines.map((l) => `<li>${l}</li>`).join("")}</ul>` : ""}`
      : "";

  const html = generalEmailLayout(`
    <p>Hello ${agentName || "there"},</p>
    <p>Your request to market the property at <strong>${propertySummary}</strong> was accepted by the publisher.</p>
    <p>The property is now visible on your public page. The publisher will pay the agent commission to you.</p>
    ${contactBlock}
  `);

  const textParts = [
    `Your request to market ${propertySummary} was accepted. The property is now on your public page.`,
    publisherName ? `Publisher: ${publisherName}` : "",
    publisherEmail ? `Publisher email: ${publisherEmail}` : "",
    publisherPhone ? `Publisher phone: ${publisherPhone}` : "",
  ].filter(Boolean);
  await sendEmail({
    to: agentEmail,
    subject: "Request To Market accepted",
    html,
    text: textParts.join("\n"),
  });
}

/**
 * Email to Publisher: Payment link to pay the marketing fee to the Agent (after they accepted).
 */
export async function notifyPublisherToPayMarketingFee(params: {
  publisherEmail: string;
  publisherName: string;
  agentName: string;
  propertySummary: string;
  paymentUrl: string;
  agentCommissionAmount: number;
}): Promise<void> {
  const { publisherEmail, publisherName, agentName, propertySummary, paymentUrl, agentCommissionAmount } = params;
  const html = generalEmailLayout(`
    <p>Hello ${publisherName || "there"},</p>
    <p>You accepted the request from <strong>${agentName}</strong> to market your property: <strong>${propertySummary}</strong>.</p>
    <p>Please complete the agent commission payment of <strong>₦${agentCommissionAmount.toLocaleString()}</strong>. This amount will be paid to the agent.</p>
    <p><a href="${paymentUrl}" style="display:inline-block;background:#09391C;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;">Pay agent commission</a></p>
    <p>This link may expire after a period of time.</p>
  `);
  await sendEmail({
    to: publisherEmail,
    subject: "Pay agent commission – Request To Market",
    html,
    text: `Pay ₦${agentCommissionAmount.toLocaleString()} to complete the agent commission: ${paymentUrl}`,
  });
}
