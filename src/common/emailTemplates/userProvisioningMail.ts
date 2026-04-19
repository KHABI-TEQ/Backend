export function adminProvisionedUserWelcome(params: {
  firstName: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
  userType: string;
}): string {
  const { firstName, email, temporaryPassword, loginUrl, userType } = params;
  return `
    <p>Hello ${firstName},</p>
    <p>Your <strong>${userType}</strong> account has been created on Khabi-Teq.</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Temporary password:</strong> ${temporaryPassword}</p>
    <p>You must <strong>change your password</strong> after your first sign-in before using the platform normally.</p>
    <p><a href="${loginUrl}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">Sign in</a></p>
    <p>If you did not expect this email, contact support.</p>
  `;
}
