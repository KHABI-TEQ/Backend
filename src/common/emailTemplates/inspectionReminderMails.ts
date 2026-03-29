import { getClientDashboardUrl } from "../../utils/clientAppUrl";

export function inspectionReminderBuyerEmail(params: {
  name: string;
  whenLabel: string;
  propertySummary: string;
  modeLabel: string;
  hoursBefore: 24 | 3 | 1;
}): string {
  const { name, whenLabel, propertySummary, modeLabel, hoursBefore } = params;
  const lead =
    hoursBefore === 24
      ? "This is a reminder that you have a property inspection scheduled for tomorrow."
      : hoursBefore === 3
        ? "This is a reminder that your property inspection is in about 3 hours."
        : "This is a reminder that your property inspection is in about 1 hour.";
  const dashboard = getClientDashboardUrl();
  return `
    <p>Hello ${name},</p>
    <p>${lead}</p>
    <ul>
      <li><strong>Property:</strong> ${propertySummary}</li>
      <li><strong>When:</strong> ${whenLabel}</li>
      <li><strong>Mode:</strong> ${modeLabel}</li>
    </ul>
    <p style="margin:20px 0;">
      <a href="${dashboard}" style="display:inline-block;background:#09391C;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;">Open dashboard</a>
    </p>
    <p style="font-size:13px;color:#666;">If you are not logged in, you will be asked to sign in first.</p>
  `;
}

export function inspectionReminderSellerEmail(params: {
  name: string;
  whenLabel: string;
  propertySummary: string;
  buyerName: string;
  modeLabel: string;
  hoursBefore: 24 | 3 | 1;
}): string {
  const { name, whenLabel, propertySummary, buyerName, modeLabel, hoursBefore } = params;
  const lead =
    hoursBefore === 24
      ? "You have an upcoming property inspection (buyer scheduled)."
      : hoursBefore === 3
        ? "Reminder: an inspection on your listing is in about 3 hours."
        : "Reminder: an inspection on your listing is in about 1 hour.";
  const dashboard = getClientDashboardUrl();
  return `
    <p>Hello ${name},</p>
    <p>${lead}</p>
    <ul>
      <li><strong>Property:</strong> ${propertySummary}</li>
      <li><strong>Buyer:</strong> ${buyerName}</li>
      <li><strong>When:</strong> ${whenLabel}</li>
      <li><strong>Mode:</strong> ${modeLabel}</li>
    </ul>
    <p style="margin:20px 0;">
      <a href="${dashboard}" style="display:inline-block;background:#09391C;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;">Open dashboard</a>
    </p>
    <p style="font-size:13px;color:#666;">If you are not logged in, you will be asked to sign in first.</p>
  `;
}
