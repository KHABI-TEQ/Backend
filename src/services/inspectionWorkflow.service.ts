import { DB } from "../controllers";
import sendEmail from "../common/send.email";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";
import notificationService from "./notification.service";
import { getPropertyTitleFromLocation } from "../utils/helper";

/**
 * Notify agent (property owner) that a buyer submitted an inspection request.
 * Email + in-app. Used when status is pending_approval.
 */
export async function notifyAgentOfInspectionRequest(params: {
  inspectionId: string;
  propertyId: any;
  ownerId: string;
  buyerName: string;
  buyerEmail: string;
  inspectionDate: Date;
  inspectionTime: string;
  amount: number;
  respondUrl?: string;
}): Promise<void> {
  const { inspectionId, propertyId, ownerId, buyerName, inspectionDate, inspectionTime, amount, respondUrl } = params;
  const property = await DB.Models.Property.findById(propertyId).select("location").lean();
  const owner = await DB.Models.User.findById(ownerId).select("email firstName lastName").lean();
  if (!owner) return;

  const location = property
    ? getPropertyTitleFromLocation(property.location) || "Property"
    : "Property";
  const title = "New inspection request";
  const message = `${buyerName} has requested an inspection for ${location} (₦${amount?.toLocaleString() || ""}). Please accept or reject the request.`;

  await notificationService.createNotification({
    user: ownerId,
    title,
    message,
    type: "inspection",
    meta: { inspectionId, propertyId: propertyId?.toString?.() ?? "", status: "pending_approval" },
  });

  const link = respondUrl || `${process.env.CLIENT_LINK}/account/inspections`;
  const html = generalEmailLayout(`
    <p>Hello ${(owner as any).firstName || (owner as any).lastName || "there"},</p>
    <p><strong>${buyerName}</strong> has requested an inspection for your property at <strong>${location}</strong>.</p>
    <p>Inspection fee: ₦${amount?.toLocaleString() || ""}</p>
    <p>Preferred date: ${inspectionDate} at ${inspectionTime}</p>
    <p>Please accept or reject this request. If you accept, the buyer will receive a payment link.</p>
    <p><a href="${link}" style="display:inline-block;background:#09391C;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;">View and respond</a></p>
  `);

  await sendEmail({
    to: (owner as any).email,
    subject: "New inspection request – action required",
    html,
    text: message,
  });
}

/**
 * Notify buyer that agent accepted the request and send payment link.
 */
export async function notifyBuyerPaymentLink(params: {
  buyerEmail: string;
  buyerName: string;
  propertyLocation: string;
  amount: number;
  paymentUrl: string;
}): Promise<void> {
  const { buyerEmail, buyerName, propertyLocation, amount, paymentUrl } = params;
  const html = generalEmailLayout(`
    <p>Hello ${buyerName || "there"},</p>
    <p>Your inspection request for <strong>${propertyLocation}</strong> has been accepted by the agent.</p>
    <p>Amount to pay: ₦${amount?.toLocaleString() || ""}</p>
    <p>Complete your payment to confirm the inspection:</p>
    <p><a href="${paymentUrl}" style="display:inline-block;background:#09391C;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;">Pay now</a></p>
    <p>This link may expire after a period of time.</p>
  `);
  await sendEmail({
    to: buyerEmail,
    subject: "Inspection accepted – complete your payment",
    html,
    text: `Your inspection was accepted. Pay ₦${amount?.toLocaleString()} here: ${paymentUrl}`,
  });
}

/**
 * Notify buyer that agent rejected the request.
 */
export async function notifyBuyerRejected(params: {
  buyerEmail: string;
  buyerName: string;
  propertyLocation: string;
  note?: string;
}): Promise<void> {
  const { buyerEmail, buyerName, propertyLocation, note } = params;
  const html = generalEmailLayout(`
    <p>Hello ${buyerName || "there"},</p>
    <p>Unfortunately, the agent has declined your inspection request for <strong>${propertyLocation}</strong>.</p>
    ${note ? `<p>Message: ${note}</p>` : ""}
    <p>You can browse other properties or submit a new request.</p>
  `);
  await sendEmail({
    to: buyerEmail,
    subject: "Inspection request declined",
    html,
    text: `Your inspection request for ${propertyLocation} was declined.${note ? ` ${note}` : ""}`,
  });
}

/**
 * Notify agent that buyer has paid (payment confirmation).
 */
export async function notifyAgentPaymentReceived(params: {
  ownerId: string;
  buyerName: string;
  propertyLocation: string;
  amount: number;
  inspectionId: string;
}): Promise<void> {
  const { ownerId, buyerName, propertyLocation, amount, inspectionId } = params;
  const owner = await DB.Models.User.findById(ownerId).select("email firstName lastName").lean();
  if (!owner) return;

  const title = "Inspection payment received";
  const message = `${buyerName} has paid ₦${amount?.toLocaleString() || ""} for the inspection at ${propertyLocation}.`;

  await notificationService.createNotification({
    user: ownerId,
    title,
    message,
    type: "inspection",
    meta: { inspectionId, status: "payment_received" },
  });

  const html = generalEmailLayout(`
    <p>Hello ${(owner as any).firstName || (owner as any).lastName || "there"},</p>
    <p><strong>${buyerName}</strong> has completed payment for the inspection at <strong>${propertyLocation}</strong>.</p>
    <p>Amount received: ₦${amount?.toLocaleString() || ""}</p>
    <p>The inspection is confirmed. Please coordinate with the buyer for the scheduled date and time.</p>
  `);
  await sendEmail({
    to: (owner as any).email,
    subject: "Inspection payment received",
    html,
    text: message,
  });
}
