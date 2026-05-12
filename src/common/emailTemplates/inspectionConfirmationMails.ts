/**
 * Email: buyer confirms the scheduled property inspection / viewing took place (1+ day after slot).
 */

export function inspectionConfirmationRequestMail(options: {
  buyerName: string;
  confirmUrl: string;
  inspectionDate: string;
  inspectionTime: string;
}): string {
  const { buyerName, confirmUrl, inspectionDate, inspectionTime } = options;
  return `
    <p>Hello ${buyerName},</p>
    <p>Your property inspection was scheduled for <strong>${inspectionDate}</strong> at <strong>${inspectionTime}</strong>.</p>
    <p>Please confirm that the inspection took place as scheduled. This updates our records and helps us follow up with the right next steps (including rating your experience).</p>
    <p style="margin: 24px 0;">
      <a href="${confirmUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Confirm inspection took place</a>
    </p>
    <p>If the inspection was cancelled or rescheduled, you can ignore this email or contact support.</p>
  `;
}
