export function deleteDeveloperMail(firstName: string, reason: string): string {
  return `
    <p>Dear ${firstName},</p>
    <p>Your developer account on Khabi-Teq has been closed by an administrator.</p>
    ${reason.trim() ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
    <p>If you believe this was a mistake, please contact support.</p>
  `;
}
