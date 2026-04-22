function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function adminProvisionedUserWelcome(params: {
  firstName: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
  userType: string;
}): string {
  const { firstName, email, temporaryPassword, loginUrl, userType } = params;
  const safeFirst = escapeHtml(firstName);
  const safeEmail = escapeHtml(email);
  const safePassword = escapeHtml(temporaryPassword);
  return `
    <p>Hello ${safeFirst},</p>
    <p>Your <strong>${escapeHtml(userType)}</strong> account has been created on Khabi-Teq.</p>
    <p><strong>Email:</strong> ${safeEmail}</p>
    <p><strong>Temporary password:</strong> <span style="font-family:monospace;letter-spacing:0.05em;">${safePassword}</span></p>
    <p>You must <strong>change your password</strong> after your first sign-in before using the platform normally.</p>
    <p><a href="${loginUrl}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">Sign in</a></p>
    <p>If you did not expect this email, contact support.</p>
  `;
}
