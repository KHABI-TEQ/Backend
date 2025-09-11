export const accountApproved = (name: string): string => {
	return `
        <p>Dear ${name},</p>
        <p>Welcome to Khabi-Teq Realty! We are excited to have you join our exclusive network of partner agents. Our platform is designed to empower you with direct access to buyer preferences, streamlined transaction processes, and advanced tools to boost your business.</p>
        <p>Get ready to unlock new opportunities and grow your real estate career with us.</p>
    `;
}; 

export const accountDisaapproved = (name: string): string => {
	return `
        <p>
        Dear ${name},

        Thank you for your interest in joining Khabi-Teq Realty. After reviewing your application, we regret to inform you that your account has not been approved at this time.

        If you have any questions or wish to provide additional information, please feel free to contact us at agent.support@khabiteqrealty.com.
        </p>
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
