export interface GenerateVerificationEmailParams {
  fullName: string;
  phoneNumber: string;
  address: string;
  amountPaid: number;
  documents: any;
}

export const generateVerificationSubmissionEmail = ({
  fullName,
  phoneNumber,
  address,
  amountPaid,
  documents,
}: GenerateVerificationEmailParams): string => {
  const docsList = documents
    .map(
      (doc: any, index: any) =>
        `<li><strong>Document ${index + 1}:</strong> ${doc.documentType} (No: ${doc.documentNumber})</li>`
    )
    .join('');

  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 600px; margin: auto;">
      <p>Dear ${fullName},</p>

      <p>Thank you for submitting your documents for verification.</p>

      <p>We have received the following details:</p>

      <ul style="padding-left: 20px;">
        <li><strong>Full Name:</strong> ${fullName}</li>
        <li><strong>Phone Number:</strong> ${phoneNumber}</li>
        <li><strong>Address:</strong> ${address}</li>
        <li><strong>Amount Paid:</strong> ₦${amountPaid.toLocaleString()}</li>
        <li><strong>Transaction Receipt:</strong> Uploaded Successfully</li>
      </ul>

      <p><strong>Document Details:</strong></p>
      <ul style="padding-left: 20px;">
        ${docsList}
      </ul>

      <p>Your submission is currently under review. We’ll notify you once the process is completed or if any clarification is needed.</p>

      <p>Thank you for choosing our service.</p>

      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;" />

      <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply directly to this email.</p>
    </div>
  `;
};



export interface GenerateThirdPartyVerificationEmailParams {
  recipientName: string; // Name of the third-party recipient
  requesterName: string; // Name of the person requesting verification
  message: string; // Custom message from requester
  accessCode: string;
  accessLink: string; // Direct link to verification page
}

export const generateThirdPartyVerificationEmail = ({
  recipientName,
  requesterName,
  message,
  accessCode,
  accessLink
}: GenerateThirdPartyVerificationEmailParams): string => {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 600px; margin: auto;">
      <p>Dear ${recipientName},</p>

      <p>${requesterName} has requested you to review and verify a submitted document.</p>

      <p><strong>Message from ${requesterName}:</strong></p>
      <blockquote style="border-left: 4px solid #ddd; padding-left: 10px; color: #555; font-style: italic;">
        ${message}
      </blockquote>

      <p><strong>Access Details:</strong></p>
      <ul style="padding-left: 20px;">
        <li><strong>Access Code:</strong> ${accessCode}</li>
        <li><strong>Access Link:</strong> <a href="${accessLink}" style="color: #0066cc; text-decoration: none;">Click here to access the verification page</a></li>
      </ul>

      <p>Please use the above access code when prompted to securely view the document verification details.</p>

      <p>This link and code are for your use only and should not be shared with unauthorized persons.</p>

      <p>Thank you for assisting in the verification process.</p>

      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;" />

      <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply directly to this email.</p>
    </div>
  `;
};


export interface GenerateAdminVerificationReportEmailParams {
  adminName: string;
  requesterName: string;
  documentCustomId: string;
  reports: {
    originalDocumentType: string;
    status: string;
    description?: string;
    newDocumentUrl?: string;
  }[];
  verificationPageLink: string;
}

export const generateAdminVerificationReportEmail = ({
  adminName,
  requesterName,
  documentCustomId,
  reports,
  verificationPageLink
}: GenerateAdminVerificationReportEmailParams): string => {
  const reportsHtml = reports.map(report => `
    <li style="margin-bottom: 12px;">
      <strong>Document Type:</strong> ${report.originalDocumentType} <br />
      <strong>Status:</strong> ${report.status} <br />
      <strong>Description:</strong> ${report.description ?? "N/A"} <br />
      ${report.newDocumentUrl ? `<strong>New Document:</strong> <a href="${report.newDocumentUrl}" style="color: #0066cc; text-decoration: none;" target="_blank">View Document</a>` : ""}
    </li>
  `).join("");

  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 600px; margin: auto;">
      <p>Dear ${adminName},</p>

      <p>${requesterName} has submitted new verification report(s) for the document verification request <strong>${documentCustomId}</strong>.</p>

      <p><strong>Verification Reports:</strong></p>
      <ul style="padding-left: 20px;">
        ${reportsHtml}
      </ul>

      <p>You can review the full details in the admin panel by clicking the link below:</p>
      <p><a href="${verificationPageLink}" style="color: #0066cc; text-decoration: none;">Access Document Verification Request</a></p>

      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;" />

      <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply directly to this email.</p>
    </div>
  `;
};
