/** Emails for professional service briefs and assigned marketplace work. */

function briefsUrl(): string {
  const base = (process.env.CLIENT_LINK || "https://khabiteq.com").replace(/\/$/, "");
  return `${base}/dashboard?section=briefs`;
}

export function professionalNewRequestEmail(params: {
  professionalName: string;
  kindLabel: string;
  referenceCode: string;
  summary: string;
  broadcast?: boolean;
}): string {
  const intro = params.broadcast
    ? `A client published a <strong>${params.kindLabel}</strong> brief. Open Service briefs on your Khabiteq account to send an offer.`
    : `A client selected you for a <strong>${params.kindLabel}</strong> brief. Open Service briefs on your Khabiteq account to send an offer.`;
  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 100%;">
      <p>Dear ${params.professionalName},</p>
      <p>${intro}</p>
      <p><strong>Reference:</strong> ${params.referenceCode}</p>
      <p>${params.summary}</p>
      <p>On Service briefs, describe what your service covers, set the fee the client will pay, and agree that Khabiteq deducts 10% of that fee from your settlement.</p>
      <p>You cannot send an offer until the bank account from your KYC is connected.</p>
      <p>The client compares offers and pays only the fee you set. Their contact details stay hidden until they complete payment.</p>
      <p><a href="${briefsUrl()}">Open Service briefs</a></p>
      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;" />
      <p style="font-size: 13px; color: #999;">This is an automated message.</p>
    </div>
  `;
}

function clientBase(): string {
  return (process.env.CLIENT_LINK || "https://www.khabiteq.com").replace(/\/$/, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buyerNewOfferEmail(params: {
  buyerName: string;
  professionalName: string;
  serviceName: string;
  coverageNote: string;
  fee: number;
  requestId: string;
}): string {
  const href = `${clientBase()}/buyer/service-requests/${params.requestId}`;
  const buyerName = escapeHtml(params.buyerName || "Client");
  const professionalName = escapeHtml(params.professionalName);
  const serviceName = escapeHtml(params.serviceName);
  const coverageNote = escapeHtml(params.coverageNote);
  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 100%;">
      <p>Dear ${buyerName},</p>
      <p><strong>${professionalName}</strong> has sent an offer on your <strong>${serviceName}</strong> brief.</p>
      <p><strong>What the service covers:</strong> ${coverageNote}</p>
      <p><strong>Service fee:</strong> ₦${Number(params.fee).toLocaleString()}</p>
      <p>Open the offer and review the coverage and fee. If you want this professional, choose the offer and pay that fee. After payment, their name, phone and email appear on the same page so you can share your documents with them directly.</p>
      <p style="margin: 24px 0;">
        <a href="${href}" style="display:inline-block;background:#09391C;color:#ffffff;padding:12px 20px;text-decoration:none;border-radius:6px;">View this offer</a>
      </p>
      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;" />
      <p style="font-size: 13px; color: #999;">This is an automated message.</p>
    </div>
  `;
}

export function buyerRequestAcceptedPayEmail(params: {
  buyerName: string;
  kindLabel: string;
  professionalName: string;
  amount: number;
  referenceCode: string;
}): string {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 100%;">
      <p>Dear ${params.buyerName},</p>
      <p><strong>${params.professionalName}</strong> accepted your <strong>${params.kindLabel}</strong> request (${params.referenceCode}).</p>
      <p>Please pay <strong>₦${Number(params.amount).toLocaleString()}</strong> in the Khabi-Teq Buyers app (Track / Pay now) to unlock the service.</p>
      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;" />
      <p style="font-size: 13px; color: #999;">This is an automated message.</p>
    </div>
  `;
}

export function buyerRequestDeclinedEmail(params: {
  buyerName: string;
  kindLabel: string;
  professionalName: string;
  reason?: string;
}): string {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 100%;">
      <p>Dear ${params.buyerName},</p>
      <p><strong>${params.professionalName}</strong> declined your <strong>${params.kindLabel}</strong> request.</p>
      ${params.reason ? `<p><strong>Reason:</strong> ${params.reason}</p>` : ""}
      <p>You can select another professional in the Khabi-Teq Buyers app.</p>
      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;" />
      <p style="font-size: 13px; color: #999;">This is an automated message.</p>
    </div>
  `;
}

export function professionalContactsUnlockedEmail(params: {
  professionalName: string;
  kindLabel: string;
  referenceCode: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  amount: number;
}): string {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 100%;">
      <p>Dear ${params.professionalName},</p>
      <p>Payment was received for <strong>${params.kindLabel}</strong> (${params.referenceCode}).</p>
      <p><strong>Amount:</strong> ₦${Number(params.amount).toLocaleString()}</p>
      <p>You may now contact the client:</p>
      <ul>
        <li><strong>Name:</strong> ${params.buyerName}</li>
        <li><strong>Email:</strong> ${params.buyerEmail}</li>
        <li><strong>Phone:</strong> ${params.buyerPhone}</li>
      </ul>
      <p>Contact the client with these details. Share documents directly, and send the full report on your company letterhead.</p>
      <p><a href="${(process.env.CLIENT_LINK || "https://www.khabiteq.com").replace(/\/$/, "")}/dashboard?section=briefs">Open Service briefs</a></p>
      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;" />
      <p style="font-size: 13px; color: #999;">This is an automated message.</p>
    </div>
  `;
}
