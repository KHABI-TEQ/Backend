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

