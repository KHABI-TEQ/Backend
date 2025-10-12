export function kycVerificationAdminNotification(
  agentName: string,
  agentEmail: string,
  reviewLink: string
): string {
  return `
    <div>
      <p>Dear Admin,</p>
      <p>A new KYC verification request has been submitted by:</p>
      <ul>
        <li><strong>Name:</strong> ${agentName}</li>
        <li><strong>Email:</strong> ${agentEmail}</li>
      </ul>
      <p>Please review and take action by visiting the link below:</p>
      <p>
        <a href="${reviewLink}" style="
          display:inline-block;
          padding:10px 16px;
          background-color:#007bff;
          color:#fff;
          text-decoration:none;
          border-radius:6px;
          font-weight:bold;
        ">Review KYC Request</a>
      </p>
      <p>If the button above doesn’t work, copy and paste this link into your browser:</p>
      <p>${reviewLink}</p>
      <br />
      <p>Best regards,<br/>Khabi-Teq Realty System</p>
    </div>
  `;
}


export const adminAccountCreated = (
  name: string,
  email: string,
  password: string,
  loginUrl: string
): string => {
  return `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
      <p>Dear <strong>${name}</strong>,</p>

      <p>Welcome to <strong>Khabi-Teq Realty</strong>! 🎉</p>

      <p>Your new admin account has been successfully created. You can now access the admin dashboard using the credentials below:</p>

      <div style="background: #f8f9fa; border-left: 4px solid #007bff; padding: 10px 15px; margin: 15px 0;">
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Password:</strong> ${password}</p>
      </div>

      <p>👉 Click the button below to log in:</p>
      <p>
        <a href="${loginUrl}" 
          style="display:inline-block; background-color:#007bff; color:#fff; text-decoration:none; padding:10px 20px; border-radius:5px; font-weight:bold;">
          Access Admin Dashboard
        </a>
      </p>

      <p>For security reasons, we recommend changing your password immediately after your first login.</p>

      <p>If you encounter any issues, please contact our IT support team at 
      <a href="mailto:support@khabiteqrealty.com">support@khabiteqrealty.com</a>.</p>

      <p>We’re excited to have you on board!</p>

      <p>Sincerely,</p>
      <p><strong>The Khabi-Teq Realty Team</strong></p>
    </div>
  `;
};


