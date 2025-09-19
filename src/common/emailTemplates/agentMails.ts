export const accountApproved = (name: string): string => {
  return `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
      <p>Dear <strong>${name}</strong>,</p>

      <p>Congratulations! 🎉 Your application has been <strong style="color:green;">approved</strong> and your agent account with <strong>Khabi-Teq Realty</strong> is now active.</p>

      <p>As part of our network, you now have access to:</p>
      <ul>
        <li>Direct access to verified buyer preferences</li>
        <li>Streamlined transaction and property management tools</li>
        <li>Real-time notifications for new opportunities</li>
        <li>Exclusive training and growth resources</li>
      </ul>

      <p><strong>What’s next?</strong></p>
      <ol>
        <li>Log into your agent dashboard</li>
        <li>Complete your profile and upload any pending documents</li>
        <li>Start exploring buyer preferences and property opportunities</li>
      </ol>

      <p>We are thrilled to have you onboard and can’t wait to see the value you’ll bring to our marketplace.</p>

      <p>Warm regards,</p>
      <p><strong>The Khabi-Teq Realty Team</strong></p>
    </div>
  `;
};


export const accountDisapproved = (name: string, reason?: string): string => {
  return `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
      <p>Dear <strong>${name}</strong>,</p>

      <p>Thank you for your interest in joining <strong>Khabi-Teq Realty</strong>. After carefully reviewing your application, we regret to inform you that your account has been 
      <strong style="color:red;">not approved</strong> at this time.</p>

      ${
        reason
          ? `<p><strong>Reason for rejection:</strong> ${reason}</p>`
          : `<p>Unfortunately, your application did not meet one or more of our onboarding requirements.</p>`
      }

      <p>If you believe this was an error, or if you’d like to strengthen your application, we encourage you to:</p>
      <ul>
        <li>Review and update your submitted documents</li>
        <li>Ensure all information provided is accurate and up to date</li>
        <li>Reach out to our support team for guidance on reapplying</li>
      </ul>

      <p>You may contact us anytime at 
      <a href="mailto:agent.support@khabiteqrealty.com">agent.support@khabiteqrealty.com</a> 
      for further assistance.</p>

      <p>We appreciate your interest in working with us and encourage you to apply again in the future.</p>

      <p>Sincerely,</p>
      <p><strong>The Khabi-Teq Realty Team</strong></p>
    </div>
  `;
};

export const accountUpgradeApprovedTemplate = (name: string): string => {
	return `
    <p>Dear ${name},</p>
    <p>Congratulations! Your upgrade request with Khabi-Teq Realty has been approved. You now have access to enhanced features and benefits. We are excited to support your growth in the real estate market.</p>
    `;
};

export const accountUpgradeDisapprovedTemplate = (name: string): string => {
	return `
    <p>Dear ${name},</p>
    <p>Thank you for your recent upgrade request with Khabi-Teq Realty. After careful consideration, we regret to inform you that your request has not been approved at this time. If you have any questions or would like to discuss further, please feel free to reach out.</p>
    `;
};

export function DeleteAgent(name: string, reason: string): string {
	return `
        <div class="">
        <h1> Hello ${name},</h1>
        <h2>Agent Deleted</h2>
        <p>Your agent account has been deleted. Due to: </p>
        ${
            reason
                ? `<p><strong>Reason:</strong> ${reason}</p>`
                : ""
        }
    `;
}


export function DeactivateOrActivateAgent(
    name: string,
    status: boolean,
    reason: string
): string {
    return `
                        <div class="">
                        <h1> Hello ${name},</h1>
                                <h2>Agent ${
                                                                                                                                    status ? "Deactivated" : "Activated"
                                                                                                                                }</h2>
                                <p>Your agent account has been ${
                                                                                                                                    status
                                                                                                                                        ? "deactivated or suspended"
                                                                                                                                        : "activated"
                                                                                                                                }</p>
                                ${
                                                                                                                                    reason
                                                                                                                                        ? `<p><strong>Reason:</strong> ${reason}</p>`
                                                                                                                                        : ""
                                                                                                                                }
                                   `;
}


export const kycSubmissionAcknowledgement = (name: string): string => {
  return `
    <p>Dear ${name},</p>
    <p>Thank you for submitting your KYC verification request with <strong>Khabi-Teq Realty</strong>.</p>
    <p>We have successfully received your request and our team will process it shortly. 
    You can expect a wonderful feedback once the review has been completed.</p>
    <p>We appreciate your patience and cooperation as we ensure compliance and the highest standards for all our agents.</p>
    <p>Best regards,<br/>The Khabi-Teq Realty Team</p>
  `;
};
