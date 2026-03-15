/**
 * Transaction confirmation request (3 days after inspection) and follow-up (after buyer confirms).
 */

export function transactionConfirmationRequestMail(options: {
  buyerName: string;
  confirmUrl: string;
  inspectionDate: string;
}): string {
  const { buyerName, confirmUrl, inspectionDate } = options;
  return `
    <p>Hello ${buyerName},</p>
    <p>Your property inspection was scheduled for <strong>${inspectionDate}</strong>. We hope it went well.</p>
    <p>If you have proceeded with a transaction (rental, purchase, or other) with the agent or developer, please confirm this to us by clicking the button below. This helps us keep our records accurate and support you with transaction registration.</p>
    <p style="margin: 24px 0;">
      <a href="${confirmUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Confirm transaction took place</a>
    </p>
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
}): string {
  const { buyerName, registerUrl } = options;
  const benefitsList = REGISTRATION_BENEFITS.map((b) => `<li>${b}</li>`).join("");
  return `
    <p>Hello ${buyerName},</p>
    <p>Thank you for confirming that your transaction took place.</p>
    <p><strong>Next step – register your transaction</strong></p>
    <p>Please go to the public transaction registration page to register your transaction. Registration has several benefits:</p>
    <ul style="margin: 16px 0; padding-left: 24px;">
      ${benefitsList}
    </ul>
    <p style="margin: 24px 0;">
      <a href="${registerUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Register my transaction</a>
    </p>
    <p>You can use the same page whether you are the buyer or the agent/developer. If you have any questions, please contact our support team.</p>
  `;
}
