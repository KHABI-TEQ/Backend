/**
 * Transaction confirmation request (3 days after inspection) and follow-up (after buyer confirms).
 */

import { transactionReferenceIdsBlock } from "./transactionReferenceIds";

export function transactionConfirmationRequestMail(options: {
  buyerName: string;
  confirmUrl: string;
  inspectionDate: string;
  inspectionTime: string;
  propertyId?: string | null;
  inspectionId?: string | null;
}): string {
  const { buyerName, confirmUrl, inspectionDate, inspectionTime, propertyId, inspectionId } = options;
  const referenceIds = transactionReferenceIdsBlock({ propertyId, inspectionId });
  return `
    <p>Hello ${buyerName},</p>
    <p>Following your scheduled inspection on <strong>${inspectionDate}</strong> at <strong>${inspectionTime}</strong>, we are checking in on the next step.</p>
    <p>If you have proceeded with a transaction (rental, purchase, or other) with the agent or developer, please confirm this to us by clicking the button below. This helps us keep our records accurate and supports you with transaction registration.</p>
    <p style="margin: 24px 0;">
      <a href="${confirmUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Confirm transaction took place</a>
    </p>
    ${referenceIds}
    <p>If you have not completed a transaction, you may ignore this email.</p>
  `;
}

const REGISTRATION_BENEFITS = [
  "Creates an official record of your transaction for your protection.",
  "Supports compliance with KHABITEQ and regulatory requirements.",
  "Helps with dispute resolution and ownership verification if needed.",
  "Provides a verifiable trail for future reference (e.g. for loans or resale).",
];

export function transactionConfirmationFollowUpMail(options: {
  buyerName: string;
  registerUrl: string;
  propertyId?: string | null;
  inspectionId?: string | null;
}): string {
  const { buyerName, registerUrl, propertyId, inspectionId } = options;
  const benefitsList = REGISTRATION_BENEFITS.map((b) => `<li>${b}</li>`).join("");
  const referenceIds = transactionReferenceIdsBlock({ propertyId, inspectionId });
  return `
    <p>Hello ${buyerName},</p>
    <p>Thank you for confirming that your transaction took place.</p>
    <p><strong>Next step – register your transaction</strong></p>
    <p>Please go to the public transaction registration page to register your transaction. Registration has several benefits:</p>
    <ul style="margin: 16px 0; padding-left: 24px;">
      ${benefitsList}
    </ul>
    ${referenceIds}
    <p style="margin: 24px 0;">
      <a href="${registerUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Register my transaction</a>
    </p>
    <p>The registration link above pre-fills your Property ID and Inspection ID when available. You can use the same page whether you are the buyer or the agent/developer. If you have any questions, please contact our support team.</p>
  `;
}

export function transactionRegistrationAcknowledgementMail(options: {
  buyerName: string;
  registrationId: string;
  transactionTypeLabel: string;
  processingFeeNaira: number;
  paymentUrl?: string;
}): string {
  const { buyerName, registrationId, transactionTypeLabel, processingFeeNaira, paymentUrl } = options;
  const feeLine =
    processingFeeNaira > 0
      ? `<p>Processing fee: <strong>₦${processingFeeNaira.toLocaleString("en-NG")}</strong>.</p>`
      : `<p>No processing fee is due for this registration at this time.</p>`;
  const paymentBlock =
    paymentUrl && processingFeeNaira > 0
      ? `<p style="margin: 24px 0;">
      <a href="${paymentUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Complete processing fee payment</a>
    </p>
    <p>If the button does not work, copy and paste this link into your browser:<br/><a href="${paymentUrl}">${paymentUrl}</a></p>`
      : "";
  return `
    <p>Hello ${buyerName},</p>
    <p>Thank you for submitting your transaction registration with KHABITEQ. We have received your application and it is now in our review queue.</p>
    <p><strong>Registration reference:</strong> ${registrationId}</p>
    <p><strong>Transaction type:</strong> ${transactionTypeLabel}</p>
    ${feeLine}
    ${paymentBlock}
    <p>Our team will review your submission and the documents you provided. You will be contacted if any additional information is required.</p>
    <p>Please keep this email for your records.</p>
  `;
}

export function transactionRegistrationCertificateIssuedMail(options: {
  buyerName: string;
  registrationId: string;
  certificateNumber: string;
  downloadPortalUrl: string;
}): string {
  const { buyerName, registrationId, certificateNumber, downloadPortalUrl } = options;
  return `
    <p>Hello ${buyerName},</p>
    <p>Your property transaction registration has been <strong>approved by LASRERA</strong> and your official registration certificate is now available.</p>
    <p><strong>Registration reference:</strong> <code style="font-size:13px;">${registrationId}</code></p>
    <p><strong>Certificate number:</strong> ${certificateNumber}</p>
    <p>To download your certificate securely, visit the KHABI-TEQ transaction registration portal and enter:</p>
    <ul style="margin: 16px 0; padding-left: 24px;">
      <li>The <strong>registration reference</strong> above</li>
      <li>The <strong>buyer email address</strong> used when you registered</li>
    </ul>
    <p style="margin: 24px 0;">
      <a href="${downloadPortalUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0B5D3B; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Download your certificate</a>
    </p>
    <p>If the button does not work, copy and paste this link into your browser:<br/><a href="${downloadPortalUrl}">${downloadPortalUrl}</a></p>
    <p>Please keep this certificate for your records. It may be presented as evidence of LASRERA compliance registration.</p>
  `;
}
