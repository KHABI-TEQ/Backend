import { DB } from "../controllers";
import sendEmail from "../common/send.email";
import { generalEmailLayout } from "../common/emailTemplates/emailLayout";
import notificationService from "./notification.service";
import { getPropertyTitleFromLocation } from "../utils/helper";
import { getClientBaseUrl, getClientDashboardUrl } from "../utils/clientAppUrl";
import { dealSiteOriginFromPublicSlug } from "../config/dealSitePublicHost";
import { isLikelyE164CapableLocalPhone, runWhatsapp } from "./whatsappClient.service";

/** User IDs of agents accepted to market this property (Request To Market). */
export function collectMarketedAgentUserIds(property: {
  marketedByAgentId?: unknown;
  marketedByAgentIds?: unknown[];
}): string[] {
  const ids = new Set<string>();
  if (property?.marketedByAgentId != null) ids.add(String(property.marketedByAgentId));
  if (Array.isArray(property?.marketedByAgentIds)) {
    for (const x of property.marketedByAgentIds) {
      if (x != null) ids.add(String(x));
    }
  }
  return [...ids];
}

function inspectionRequestFeeSummary(amount: number): string {
  return amount != null && amount > 0 ? `₦${amount.toLocaleString()}` : "No inspection fee (this request)";
}

function inspectionRequestScheduleSummary(inspectionDate: Date, inspectionTime: string): string {
  return `${inspectionDate} at ${inspectionTime}`;
}

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
}): Promise<void> {
  const { inspectionId, propertyId, ownerId, buyerName, inspectionDate, inspectionTime, amount } = params;
  const property = await DB.Models.Property.findById(propertyId).select("location").lean();
  const owner = await DB.Models.User.findById(ownerId).select("email firstName lastName phoneNumber").lean();
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

  const link = getClientDashboardUrl();
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

  const ownerPhone = String((owner as any).phoneNumber || "").replace(/\s/g, "");
  const recipientName =
    [(owner as any).firstName, (owner as any).lastName].filter(Boolean).join(" ") || "there";
  if (isLikelyE164CapableLocalPhone(ownerPhone)) {
    void runWhatsapp("inspection_request_primary", async (wa) => {
      await wa.sendMessage(ownerPhone, "inspection_request_alert", {
        recipientName,
        buyerName,
        propertySummary: location,
        scheduleSummary: inspectionRequestScheduleSummary(inspectionDate, inspectionTime),
        feeSummary: inspectionRequestFeeSummary(amount),
        actionNote:
          "Please accept or reject this request in your KHABITEQ dashboard. Representatives are notified separately.",
      });
    });
  }
}

/**
 * CC the true property owner when an Agent DealSite receives an inspection request
 * for a property marketed on behalf of another owner.
 */
export async function notifyTrueOwnerCcOfInspectionRequest(params: {
  inspectionId: string;
  propertyId: any;
  trueOwnerId: string;
  marketerName: string;
  buyerName: string;
  inspectionDate: Date;
  inspectionTime: string;
}): Promise<void> {
  const {
    inspectionId,
    propertyId,
    trueOwnerId,
    marketerName,
    buyerName,
    inspectionDate,
    inspectionTime,
  } = params;
  const property = await DB.Models.Property.findById(propertyId).select("location").lean();
  const owner = await DB.Models.User.findById(trueOwnerId).select("email firstName lastName phoneNumber").lean();
  if (!owner) return;

  const location = property
    ? getPropertyTitleFromLocation(property.location) || "Property"
    : "Property";

  const title = "Inspection request update (CC)";
  const message = `${buyerName} requested an inspection for ${location} via ${marketerName}'s DealSite.`;

  await notificationService.createNotification({
    user: trueOwnerId,
    title,
    message,
    type: "inspection",
    meta: {
      inspectionId,
      propertyId: propertyId?.toString?.() ?? "",
      status: "pending_approval",
      role: "true_owner_cc",
    },
  });

  const link = getClientDashboardUrl();
  const html = generalEmailLayout(`
    <p>Hello ${(owner as any).firstName || (owner as any).lastName || "there"},</p>
    <p>This is to inform you that <strong>${buyerName}</strong> requested an inspection for your property at <strong>${location}</strong>.</p>
    <p>The request was submitted through <strong>${marketerName}</strong>'s DealSite (accepted marketer).</p>
    <p>Preferred date: ${inspectionDate} at ${inspectionTime}</p>
    <p>You are copied for visibility while the marketer handles buyer-facing communication.</p>
    <p><a href="${link}" style="display:inline-block;background:#09391C;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;">Open dashboard</a></p>
  `);

  if (owner.email) {
    await sendEmail({
      to: owner.email,
      subject: "Inspection request update for your property",
      html,
      text: message,
    });
  }

  const ccPhone = String((owner as any).phoneNumber || "").replace(/\s/g, "");
  const ccName =
    [(owner as any).firstName, (owner as any).lastName].filter(Boolean).join(" ") || "there";
  if (isLikelyE164CapableLocalPhone(ccPhone)) {
    void runWhatsapp("inspection_request_true_owner_cc", async (wa) => {
      await wa.sendMessage(ccPhone, "inspection_request_alert", {
        recipientName: ccName,
        buyerName,
        propertySummary: location,
        scheduleSummary: inspectionRequestScheduleSummary(inspectionDate, inspectionTime),
        feeSummary: "No inspection fee (this request)",
        actionNote: `Submitted via ${marketerName}'s public page. They will accept or reject; you have visibility only.`,
      });
    });
  }
}

/**
 * Landlords / Developers: email + WhatsApp to saved representatives (no in-app notification).
 */
export async function notifyPublisherRepresentativesInspectionRequest(params: {
  publisherUserId: string;
  buyerName: string;
  inspectionDate: Date;
  inspectionTime: string;
  amount: number;
  propertyLocation: string;
}): Promise<void> {
  const pub = await DB.Models.User.findById(params.publisherUserId)
    .select("userType inspectionNotificationRepresentatives email")
    .lean();
  if (!pub) return;
  if (pub.userType !== "Landowners" && pub.userType !== "Developer") return;

  const reps = (pub as any).inspectionNotificationRepresentatives as
    | { label?: string; email?: string; whatsappNumber?: string }[]
    | undefined;
  if (!Array.isArray(reps) || reps.length === 0) return;

  const feeSummary = inspectionRequestFeeSummary(params.amount);
  const scheduleSummary = inspectionRequestScheduleSummary(params.inspectionDate, params.inspectionTime);
  const publisherEmail = String((pub as any).email || "").toLowerCase();

  for (const r of reps) {
    const label = (r.label || "").trim();
    const repName = label || "there";
    const em = (r.email || "").trim().toLowerCase();

    if (em && em.includes("@")) {
      if (em === publisherEmail) continue;
      const html = generalEmailLayout(`
        <p>Hello ${repName === "there" ? "there" : repName},</p>
        <p>You are receiving this because you are listed as an inspection notification contact for a landlord/developer on KHABITEQ.</p>
        <p><strong>${params.buyerName}</strong> requested an inspection for <strong>${params.propertyLocation}</strong>.</p>
        <p>Preferred date: ${params.inspectionDate} at ${params.inspectionTime}</p>
        <p>Inspection fee context: ${feeSummary}</p>
        <p><strong>Only the property owner or marketer can accept or reject</strong> in the app; this message is for your awareness.</p>
      `);
      await sendEmail({
        to: em,
        subject: "New inspection request (representative notification)",
        html,
        text: `${params.buyerName} requested an inspection for ${params.propertyLocation}. ${scheduleSummary}.`,
      });
    }

    const waLine = String(r.whatsappNumber || "").replace(/\s/g, "");
    if (isLikelyE164CapableLocalPhone(waLine)) {
      void runWhatsapp("inspection_request_representative", async (wa) => {
        await wa.sendMessage(waLine, "inspection_request_alert", {
          recipientName: repName,
          buyerName: params.buyerName,
          propertySummary: params.propertyLocation,
          scheduleSummary,
          feeSummary,
          actionNote:
            "You are notified as a representative. Only the owner or marketer can accept or reject in the app.",
        });
      });
    }
  }
}

/**
 * Agents who market this property (main marketplace) — same inspection alert as additional recipients.
 */
export async function notifyMarketingAgentsInspectionRequest(params: {
  property: {
    _id?: unknown;
    owner?: unknown;
    marketedByAgentId?: unknown;
    marketedByAgentIds?: unknown[];
    location?: unknown;
  };
  inspectionId: string;
  buyerName: string;
  inspectionDate: Date;
  inspectionTime: string;
  amount: number;
  excludeUserIds?: Set<string>;
}): Promise<void> {
  const exclude = params.excludeUserIds ?? new Set<string>();
  const ownerStr = params.property?.owner != null ? String(params.property.owner) : "";

  for (const agentId of collectMarketedAgentUserIds(params.property)) {
    if (!agentId || agentId === ownerStr || exclude.has(agentId)) continue;

    const agentUser = await DB.Models.User.findById(agentId)
      .select("email firstName lastName phoneNumber userType")
      .lean();
    if (!agentUser || agentUser.userType !== "Agent") continue;

    const location =
      getPropertyTitleFromLocation((params.property as any).location) || "Property";
    const title = "New inspection request (property you market)";
    const hasFee = params.amount != null && params.amount > 0;
    const msg = hasFee
      ? `${params.buyerName} requested an inspection for ${location} (₦${params.amount.toLocaleString()}). Please accept or reject.`
      : `${params.buyerName} requested an inspection for ${location}. Please accept or reject.`;

    await notificationService.createNotification({
      user: agentId,
      title,
      message: msg,
      type: "inspection",
      meta: {
        inspectionId: params.inspectionId,
        propertyId: params.property?._id != null ? String(params.property._id) : "",
        status: "pending_approval",
        role: "marketing_agent",
      },
    });

    const link = getClientDashboardUrl();
    const feeLine = hasFee ? `<p>Inspection fee: ₦${params.amount.toLocaleString()}</p>` : "";
    if (agentUser.email) {
      const html = generalEmailLayout(`
        <p>Hello ${(agentUser as any).firstName || (agentUser as any).lastName || "there"},</p>
        <p><strong>${params.buyerName}</strong> requested an inspection for a property you market: <strong>${location}</strong>.</p>
        ${feeLine}
        <p>Preferred date: ${params.inspectionDate} at ${params.inspectionTime}</p>
        <p>Please accept or reject this request in your dashboard.</p>
        <p><a href="${link}" style="display:inline-block;background:#09391C;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;">View and respond</a></p>
      `);
      await sendEmail({
        to: agentUser.email,
        subject: "New inspection request – property you market",
        html,
        text: msg,
      });
    }

    const phone = String((agentUser as any).phoneNumber || "").replace(/\s/g, "");
    const agentName =
      [(agentUser as any).firstName, (agentUser as any).lastName].filter(Boolean).join(" ") ||
      "there";
    if (isLikelyE164CapableLocalPhone(phone)) {
      void runWhatsapp("inspection_request_marketing_agent", async (wa) => {
        await wa.sendMessage(phone, "inspection_request_alert", {
          recipientName: agentName,
          buyerName: params.buyerName,
          propertySummary: location,
          scheduleSummary: inspectionRequestScheduleSummary(params.inspectionDate, params.inspectionTime),
          feeSummary: inspectionRequestFeeSummary(params.amount),
          actionNote: "Please accept or reject in your KHABITEQ dashboard.",
        });
      });
    }
  }
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

/**
 * Get the frontend base URL for an inspection: DealSite subdomain if from DealSite, else main app.
 */
export async function getInspectionFrontendBaseUrl(inspection: {
  receiverMode?: { type?: string; dealSiteID?: any };
}): Promise<string> {
  const base = getClientBaseUrl();
  if (inspection.receiverMode?.type === "dealSite" && inspection.receiverMode?.dealSiteID) {
    const dealSite = await DB.Models.DealSite.findById(inspection.receiverMode.dealSiteID)
      .select("publicSlug")
      .lean();
    if (dealSite?.publicSlug) {
      return dealSiteOriginFromPublicSlug((dealSite as any).publicSlug);
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
    .populate("requestedBy", "fullName email phoneNumber whatsAppNumber")
    .populate("propertyId", "title location")
    .populate("owner", "firstName lastName fullName email phoneNumber")
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
  const property = inv.propertyId;
  const propertyName =
    property?.title || getPropertyTitleFromLocation(property?.location) || "the property";
  const owner = inv.owner;

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

  const buyerLine = String(buyer.whatsAppNumber || buyer.phoneNumber || "").replace(
    /\s/g,
    ""
  );
  const agentPhone = String((owner as any)?.phoneNumber || "").replace(/\s/g, "");
  if (
    isLikelyE164CapableLocalPhone(buyerLine) &&
    isLikelyE164CapableLocalPhone(agentPhone) &&
    owner
  ) {
    const agentName =
      [owner.firstName, owner.lastName].filter(Boolean).join(" ") ||
      owner.fullName ||
      "your agent";
    void runWhatsapp("inspection_viewing_completed", async (wa) => {
      await wa.sendMessage(buyerLine, "viewing_completed", {
        userName: buyerName,
        propertyName,
        agentName,
        agentPhone,
      });
    });
  }
}
