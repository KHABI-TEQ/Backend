import { DB } from "../controllers";
import sendEmail from "../common/send.email";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";
import notificationService from "./notification.service";
import { getPropertyTitleFromLocation } from "../utils/helper";

/**
 * Notify agent (property owner) that a buyer submitted an inspection request.
 * Email + in-app. Used when status is pending_approval.
 * When amount is 0 (e.g. DealSite), fee line and payment-link wording are omitted.
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
  const hasFee = amount != null && amount > 0;
  const message = hasFee
    ? `${buyerName} has requested an inspection for ${location} (₦${amount.toLocaleString()}). Please accept or reject the request.`
    : `${buyerName} has requested an inspection for ${location}. Please accept or reject the request.`;

  await notificationService.createNotification({
    user: ownerId,
    title,
    message,
    type: "inspection",
    meta: { inspectionId, propertyId: propertyId?.toString?.() ?? "", status: "pending_approval" },
  });

  const link = respondUrl || `${process.env.CLIENT_LINK}/account/inspections`;
  const feeLine = hasFee ? `<p>Inspection fee: ₦${amount.toLocaleString()}</p>` : "";
  const acceptLine = hasFee
    ? "<p>Please accept or reject this request. If you accept, the buyer will receive a payment link.</p>"
    : "<p>Please accept or reject this request. If you accept, the buyer will be notified.</p>";
  const html = generalEmailLayout(`
    <p>Hello ${(owner as any).firstName || (owner as any).lastName || "there"},</p>
    <p><strong>${buyerName}</strong> has requested an inspection for your property at <strong>${location}</strong>.</p>
    ${feeLine}
    <p>Preferred date: ${inspectionDate} at ${inspectionTime}</p>
    ${acceptLine}
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
 * Property details for the "inspection accepted" buyer email (e.g. DealSite).
 */
export interface InspectionAcceptedPropertyDetails {
  title: string;
  address?: string;
  price?: number;
  briefType?: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  toilets?: number;
  carPark?: number;
  viewPropertyUrl?: string;
  imageUrl?: string;
}

/**
 * Notify buyer that agent accepted the request (no payment – e.g. DealSite).
 * Email does not contain a payment link. Optionally includes professional property details.
 */
export async function notifyBuyerAcceptedNoPayment(params: {
  buyerEmail: string;
  buyerName: string;
  propertyLocation: string;
  propertyDetails?: InspectionAcceptedPropertyDetails;
  inspectionDate?: string;
  inspectionTime?: string;
}): Promise<void> {
  const { buyerEmail, buyerName, propertyLocation, propertyDetails, inspectionDate, inspectionTime } = params;

  const detailsSection = propertyDetails
    ? (() => {
        const addr =
          propertyDetails.address && propertyDetails.address !== propertyDetails.title
            ? `<p><strong>Address:</strong> ${propertyDetails.address}</p>`
            : "";
        const price =
          propertyDetails.price != null && propertyDetails.price > 0
            ? `<p><strong>Price:</strong> ₦${propertyDetails.price.toLocaleString()}</p>`
            : "";
        const typeParts = [propertyDetails.briefType, propertyDetails.propertyType].filter(Boolean);
        const typeLine =
          typeParts.length > 0 ? `<p><strong>Type:</strong> ${typeParts.join(" · ")}</p>` : "";
        const beds =
          propertyDetails.bedrooms != null
            ? `<p><strong>Bedrooms:</strong> ${propertyDetails.bedrooms}</p>`
            : "";
        const baths =
          propertyDetails.bathrooms != null
            ? `<p><strong>Bathrooms:</strong> ${propertyDetails.bathrooms}</p>`
            : "";
        const toilets =
          propertyDetails.toilets != null
            ? `<p><strong>Toilets:</strong> ${propertyDetails.toilets}</p>`
            : "";
        const parking =
          propertyDetails.carPark != null
            ? `<p><strong>Parking:</strong> ${propertyDetails.carPark}</p>`
            : "";
        const viewLink =
          propertyDetails.viewPropertyUrl
            ? `<p><a href="${propertyDetails.viewPropertyUrl}" style="display:inline-block;background:#09391C;color:white;padding:10px 18px;text-decoration:none;border-radius:6px;margin-top:8px;">View property</a></p>`
            : "";
        const img =
          propertyDetails.imageUrl
            ? `<p style="margin:12px 0;"><img src="${propertyDetails.imageUrl}" alt="Property" style="max-width:100%;height:auto;border-radius:8px;max-height:200px;object-fit:cover;" /></p>`
            : "";
        return `
    <div style="margin:20px 0;padding:16px;background:#f8f9fa;border-radius:8px;border:1px solid #e9ecef;">
      <p style="margin:0 0 12px 0;font-weight:600;color:#09391C;">Property details</p>
      <p style="margin:0 0 8px 0;"><strong>${propertyDetails.title}</strong></p>
      ${addr}
      ${price}
      ${typeLine}
      ${beds}
      ${baths}
      ${toilets}
      ${parking}
      ${img}
      ${viewLink}
    </div>`;
      })()
    : "";

  const scheduleLine =
    inspectionDate || inspectionTime
      ? `<p><strong>Scheduled:</strong> ${[inspectionDate, inspectionTime].filter(Boolean).join(" at ")}</p>`
      : "";

  const html = generalEmailLayout(`
    <p>Hello ${buyerName || "there"},</p>
    <p>Your inspection request for <strong>${propertyLocation}</strong> has been accepted by the agent.</p>
    ${detailsSection}
    ${scheduleLine}
    <p>The agent will coordinate with you for the scheduled date and time.</p>
  `);

  const textParts = [
    `Your inspection request for ${propertyLocation} has been accepted.`,
    propertyDetails ? `Property: ${propertyDetails.title}${propertyDetails.address ? ` — ${propertyDetails.address}` : ""}.` : "",
    inspectionDate || inspectionTime ? `Scheduled: ${[inspectionDate, inspectionTime].filter(Boolean).join(" at ")}.` : "",
    "The agent will coordinate with you for the scheduled date and time.",
  ].filter(Boolean);
  await sendEmail({
    to: buyerEmail,
    subject: "Inspection accepted – " + (propertyDetails?.title || propertyLocation),
    html,
    text: textParts.join(" "),
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

/** DealSite subdomain base URL format (e.g. https://realhomes.khabiteq.com) */
const DEALSITE_BASE_URL_FORMAT = "https://{publicSlug}.khabiteq.com";

/**
 * Get the frontend base URL for an inspection: DealSite subdomain if from DealSite, else main app.
 */
export async function getInspectionFrontendBaseUrl(inspection: {
  receiverMode?: { type?: string; dealSiteID?: any };
}): Promise<string> {
  const base = (process.env.CLIENT_LINK || "").replace(/\/$/, "");
  if (inspection.receiverMode?.type === "dealSite" && inspection.receiverMode?.dealSiteID) {
    const dealSite = await DB.Models.DealSite.findById(inspection.receiverMode.dealSiteID)
      .select("publicSlug")
      .lean();
    if (dealSite?.publicSlug) {
      return DEALSITE_BASE_URL_FORMAT.replace("{publicSlug}", (dealSite as any).publicSlug);
    }
  }
  return base;
}

/**
 * Send email to buyer after inspection is completed with links to rate and report the agent.
 * Base URL is the agent's DealSite (e.g. https://realhomes.khabiteq.com) or main app.
 */
export async function sendInspectionRateReportEmailToBuyer(inspectionId: string): Promise<void> {
  const inspection = await DB.Models.InspectionBooking.findById(inspectionId)
    .populate("requestedBy")
    .populate("propertyId")
    .lean();
  if (!inspection) return;
  const inv = inspection as any;
  if (inv.stage !== "completed" || inv.status !== "completed") return;

  const buyer = inv.requestedBy;
  if (!buyer?.email) return;

  const baseUrl = await getInspectionFrontendBaseUrl(inv);
  const rateLink = `${baseUrl}/inspection/rate?inspectionId=${inspectionId}`;
  const reportLink = `${baseUrl}/report-agent?inspectionId=${inspectionId}`;
  const buyerName = buyer.fullName || buyer.email || "there";

  const html = generalEmailLayout(`
    <p>Hello ${buyerName},</p>
    <p>Your inspection has been completed. We’d love to hear about your experience.</p>
    <p><strong>Rate your experience:</strong> <a href="${rateLink}">${rateLink}</a></p>
    <p><strong>To report the agent for this inspection:</strong> <a href="${reportLink}">${reportLink}</a></p>
    <p>Thank you for using our platform.</p>
  `);

  await sendEmail({
    to: buyer.email,
    subject: "Inspection completed – rate your experience",
    html,
    text: `Rate your experience: ${rateLink}\nTo report the agent: ${reportLink}`,
  });
}
