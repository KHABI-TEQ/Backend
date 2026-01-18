import { kebabToTitleCase } from "../../utils/helper";

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
  const docsList = `<li><strong>Document 1:</strong> ${documents.documentType} (No: ${documents.documentNumber})</li>`

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
  report: {
    originalDocumentType: string;
    status: string;
    description?: string;
    newDocumentUrl?: string;
    verifiedAt?: Date;
    selfVerification?: boolean;
  };
  additionalDocuments?: {
    name: string;
    documentFile: string;
    comment?: string;
    uploadedAt?: Date;
  }[];
  verificationPageLink: string;
}

export const generateAdminVerificationReportEmail = ({
  adminName,
  requesterName,
  documentCustomId,
  report,
  additionalDocuments,
  verificationPageLink,
}: GenerateAdminVerificationReportEmailParams): string => {
  const reportHtml = `
    <li style="margin-bottom: 12px;">
      <strong>Document Type:</strong> ${kebabToTitleCase(report.originalDocumentType)} <br />
      <strong>Status:</strong> ${report.status} <br />
      <strong>Description:</strong> ${report.description ?? "N/A"} <br />
      ${
        report.newDocumentUrl
          ? `<strong>New Document:</strong>
             <a href="${report.newDocumentUrl}" target="_blank" style="color:#0066cc;text-decoration:none;">
               View Document
             </a>`
          : ""
      }
    </li>
  `;

  const additionalDocsHtml =
    additionalDocuments?.length
      ? `
        <p><strong>Additional Supporting Documents:</strong></p>
        <ul style="padding-left:20px;">
          ${additionalDocuments
            .map(
              (doc) => `
              <li style="margin-bottom:10px;">
                <strong>Name:</strong> ${doc.name}<br />
                ${doc.comment ? `<strong>Comment:</strong> ${doc.comment}<br />` : ""}
                <a href="${doc.documentFile}" target="_blank" style="color:#0066cc;text-decoration:none;">
                  View Document
                </a>
              </li>
            `
            )
            .join("")}
        </ul>
      `
      : "";

  return `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#333;max-width:600px;margin:auto;line-height:1.6;">
      <p>Dear ${adminName},</p>

      <p>
        ${requesterName} has submitted a new verification report for the document
        verification request <strong>${documentCustomId}</strong>.
      </p>

      <p><strong>Verification Report:</strong></p>
      <ul style="padding-left:20px;">
        ${reportHtml}
      </ul>

      ${additionalDocsHtml}

      <p>
        <a href="${verificationPageLink}" style="color:#0066cc;text-decoration:none;">
          Access Document Verification Request
        </a>
      </p>

      <hr style="border:none;border-top:1px solid #ccc;margin:30px 0;" />

      <p style="font-size:13px;color:#999;">
        This is an automated message. Please do not reply directly to this email.
      </p>
    </div>
  `;
};


export const generateBuyerVerificationReportForBuyer = ({
  buyerName,
  documentCustomId,
  reports,
  additionalDocuments,
}: {
  buyerName: string;
  documentCustomId: string;
  reports: {
    originalDocumentType?: string;
    newDocumentUrl?: string;
    description?: string;
    status?: "registered" | "unregistered" | "pending";
    verifiedAt?: Date;
    selfVerification?: boolean;
  }[];
  additionalDocuments?: {
    name: string;
    documentFile: string;
    comment?: string;
    uploadedAt?: Date;
  }[];
}): string => {
  const reportsHtml = reports
    .map(
      (report) => `
      <li style="margin-bottom:12px;">
        <strong>Document Type:</strong> ${kebabToTitleCase(report.originalDocumentType) ?? "N/A"}<br />
        <strong>Status:</strong> ${report.status}<br />
        <strong>Description:</strong> ${report.description ?? "N/A"}<br />
        ${
          report.newDocumentUrl
            ? `<strong>New Document:</strong>
               <a href="${report.newDocumentUrl}" target="_blank" style="color:#0066cc;text-decoration:none;">
                 View Document
               </a>`
            : ""
        }
        ${
          report.verifiedAt
            ? `<br /><strong>Verified At:</strong> ${new Date(report.verifiedAt).toLocaleString()}`
            : ""
        }
      </li>
    `
    )
    .join("");

  const additionalDocsHtml =
    additionalDocuments?.length
      ? `
        <p><strong>Supporting Documents:</strong></p>
        <ul style="padding-left:20px;">
          ${additionalDocuments
            .map(
              (doc) => `
              <li style="margin-bottom:10px;">
                <strong>Name:</strong> ${doc.name}<br />
                ${doc.comment ? `<strong>Comment:</strong> ${doc.comment}<br />` : ""}
                <a href="${doc.documentFile}" target="_blank" style="color:#0066cc;text-decoration:none;">
                  View Document
                </a>
              </li>
            `
            )
            .join("")}
        </ul>
      `
      : "";

  return `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#333;max-width:600px;margin:auto;line-height:1.6;">
      <p>Dear ${buyerName},</p>

      <p>
        The verification reports for your document request
        <strong>${documentCustomId}</strong> are now available.
      </p>

      <p><strong>Verification Report(s):</strong></p>
      <ul style="padding-left:20px;">
        ${reportsHtml}
      </ul>

      ${additionalDocsHtml}

      <p>If you have any questions, kindly contact support.</p>

      <hr style="border:none;border-top:1px solid #ccc;margin:30px 0;" />

      <p style="font-size:13px;color:#999;">
        This is an automated message. Please do not reply directly to this email.
      </p>
    </div>
  `;
};


