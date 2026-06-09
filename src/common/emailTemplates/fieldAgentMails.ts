import { getClientBaseUrl } from "../../utils/clientAppUrl";
import { getDealSiteRootHost } from "../../config/dealSitePublicHost";

function fieldAgentMainWebOrigin(): string {
  const b = getClientBaseUrl();
  return b || `https://www.${getDealSiteRootHost()}`;
}

const fieldAgentSupportEmail =
  process.env.MAIN_SUPPORT_EMAIL || `support@${getDealSiteRootHost()}`;

export const FieldAgentCreated = (firstName: string, email: string, password: string): string => {
  return `
    <h2 style="color:#09391C;">Welcome to the Team, ${firstName}!</h2>
    <p>Your Field Agent account has been created successfully.</p>
    <p>Here are your login details:</p>
    <ul style="line-height: 1.8;">
      <li><strong>Email:</strong> ${email}</li>
      <li><strong>Password:</strong> ${password}</li>
    </ul>
    <p>We strongly recommend that you log in and change your password immediately for security reasons.</p>
    <a href="${fieldAgentMainWebOrigin()}/auth/login" style="display:inline-block;background-color:#09391C;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;margin-top:20px;">Log in to Your Dashboard</a>
  `;
};


export const DeleteFieldAgent = (fullNameOrEmail: string, reason: string): string => {
  return `
    <h2 style="color:#B00020;">Your Field Agent Account Has Been Deleted</h2>
    <p>Dear ${fullNameOrEmail},</p>
    <p>This is to inform you that your Field Agent account has been deleted from the system.</p>
    <p><strong>Reason:</strong> ${reason}</p>
    <p>If you believe this was a mistake or you have any questions, please contact support immediately.</p>
    <a href="mailto:${fieldAgentSupportEmail}" style="display:inline-block;background-color:#B00020;color:white;padding:10px 16px;text-decoration:none;border-radius:6px;margin-top:20px;">Contact Support</a>
  `;
};


export const ToggleFieldAgentStatus = (
  fullNameOrEmail: string,
  isInactive: boolean,
  reason: string
): string => {
  return `
    <h2 style="color:${isInactive ? '#B00020' : '#09391C'};">
      Your Account Has Been ${isInactive ? 'Deactivated' : 'Activated'}
    </h2>
    <p>Hi ${fullNameOrEmail},</p>
    <p>Your Field Agent account has been <strong>${isInactive ? 'temporarily deactivated' : 're-activated'}</strong>.</p>
    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
    <p>If you have questions or need further clarification, please reach out.</p>
    <a href="mailto:${fieldAgentSupportEmail}" style="display:inline-block;background-color:${isInactive ? '#B00020' : '#09391C'};color:white;padding:10px 16px;text-decoration:none;border-radius:6px;margin-top:20px;">Contact Support</a>
  `;
};


export const InspectionAssigned = (
  firstName: string,
  inspectionDate: string,
  inspectionTime: string
): string => {
  return `
    <h2 style="color:#09391C;">You Have a New Inspection</h2>
    <p>Hi ${firstName},</p>
    <p>A new inspection has been assigned to you:</p>
    <ul style="line-height: 1.8;">
      <li><strong>Date:</strong> ${inspectionDate}</li>
      <li><strong>Time:</strong> ${inspectionTime}</li>
    </ul>
    <p>Please check your dashboard for full details and prepare accordingly.</p>
    <a href="/field-agent/inspections" style="display:inline-block;background-color:#09391C;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;margin-top:20px;">View Inspection</a>
  `;
};


export const InspectionRemoved = (
  firstName: string,
  inspectionDate: string,
  inspectionTime: string
): string => {
  return `
    <h2 style="color:#B00020;">Inspection Removed</h2>
    <p>Hi ${firstName},</p>
    <p>The following inspection has been removed from your assignments:</p>
    <ul style="line-height: 1.8;">
      <li><strong>Date:</strong> ${inspectionDate}</li>
      <li><strong>Time:</strong> ${inspectionTime}</li>
    </ul>
    <p>If you have any questions, feel free to contact your supervisor.</p>
  `;
};

function adminButton(href: string, label: string): string {
  return `
    <p>
      <a href="${href}" style="
        display:inline-block;
        padding:10px 16px;
        background-color:#09391C;
        color:#fff;
        text-decoration:none;
        border-radius:6px;
        font-weight:bold;
      ">${label}</a>
    </p>
  `;
}

export function fieldAgentRepresentationAdminAlert(params: {
  agentName: string;
  agentEmail: string;
  fieldAgentName: string;
  fieldAgentEmail: string;
  propertySummary: string;
  inspectionDate?: string;
  note?: string;
  reviewLink: string;
  queueLink: string;
}): string {
  return `
    <div>
      <p>Dear Admin,</p>
      <p>An Agent has submitted a new <strong>Field Agent representation request</strong> that is awaiting response.</p>
      <ul>
        <li><strong>Requesting Agent:</strong> ${params.agentName} (${params.agentEmail})</li>
        <li><strong>Target Field Agent:</strong> ${params.fieldAgentName} (${params.fieldAgentEmail})</li>
        <li><strong>Property:</strong> ${params.propertySummary}</li>
        ${params.inspectionDate ? `<li><strong>Inspection date:</strong> ${params.inspectionDate}</li>` : ""}
        ${params.note ? `<li><strong>Agent note:</strong> ${params.note}</li>` : ""}
      </ul>
      <p>Commission is shared 40% to 60% between Khabi-Teq (the company) and the requesting Agent outside the app when the deal completes.</p>
      ${adminButton(params.reviewLink, "Track inspection flow")}
      ${adminButton(params.queueLink, "Open representation queue")}
    </div>
  `;
}

export function fieldAgentRepresentationPendingDigest(params: {
  pendingCount: number;
  acceptedAwaitingAssignment: number;
  queueLink: string;
  rows: Array<{
    propertyLabel: string;
    location: string;
    agentName: string;
    fieldAgentName: string;
    requestedAt: string;
    reviewLink: string;
  }>;
}): string {
  const listItems = params.rows
    .map(
      (row) => `
      <li style="margin-bottom:12px;">
        <strong>${row.propertyLabel}</strong> — ${row.location}<br/>
        Agent: ${row.agentName} → Field Agent: ${row.fieldAgentName}<br/>
        Requested: ${row.requestedAt}<br/>
        <a href="${row.reviewLink}">Track inspection</a>
      </li>
    `,
    )
    .join("");

  return `
    <div>
      <p>Dear Admin,</p>
      <p>This is your daily summary of open Field Agent representation activity:</p>
      <ul>
        <li><strong>${params.pendingCount}</strong> request(s) pending Field Agent response</li>
        <li><strong>${params.acceptedAwaitingAssignment}</strong> accepted but awaiting admin assignment</li>
      </ul>
      ${params.rows.length ? `<p><strong>Pending requests:</strong></p><ul>${listItems}</ul>` : ""}
      ${adminButton(params.queueLink, "Review all in admin dashboard")}
    </div>
  `;
}
