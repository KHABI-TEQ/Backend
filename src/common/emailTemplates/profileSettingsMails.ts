export interface GenerateAccountDeletionRequestEmailParams {
  fullName: string;
  deletionRequestDate: string; // e.g., "Sept 5, 2025"
  cancellationDate: string; // 7 days from request date, e.g., "Sept 12, 2025"
  revertDeletionLink: string; // Link to revert the deletion request
}

export const generateAccountDeletionRequestEmail = ({
  fullName,
  deletionRequestDate,
  cancellationDate,
  revertDeletionLink,
}: GenerateAccountDeletionRequestEmailParams): string => {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 600px; margin: auto;">
      <p>Dear ${fullName},</p>

      <p>This email confirms that we have received your request to delete your account, submitted on <strong>${deletionRequestDate}</strong>.</p>

      <p>Your account is scheduled to be permanently deleted on <strong>${cancellationDate}</strong>. Until then, your account will remain active, and you can continue to use our services as normal.</p>

      <p>If you change your mind and wish to cancel this deletion request, you can do so at any time before ${cancellationDate} by clicking the link below:</p>

      <p style="text-align: center; margin-top: 25px;">
        <a href="${revertDeletionLink}"
          style="display:inline-block; padding:12px 20px; background:#f44336; color:#fff; text-decoration:none; border-radius:4px; font-weight:bold;">
          Revert Account Deletion Request
        </a>
      </p>

      <p style="margin-top: 25px;">After ${cancellationDate}, your account and all associated data will be permanently removed and cannot be recovered.</p>

      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;" />

      <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply directly to this email.</p>
    </div>
  `;
};



export interface GenerateAccountDeletedEmailParams {
  fullName: string;
  deletionDate: string; // e.g., "Sept 12, 2025"
}

export const generateAccountDeletedEmail = ({
  fullName,
  deletionDate,
}: GenerateAccountDeletedEmailParams): string => {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 600px; margin: auto;">
      <p>Dear ${fullName},</p>

      <p>This is to confirm that your account has been successfully and permanently deleted as per your request on <strong>${deletionDate}</strong>.</p>

      <p>All your data associated with this account has been removed from our systems.</p>

      <p>We're sorry to see you go and hope you had a good experience with us. If you ever wish to return, you are welcome to create a new account.</p>

      <p style="margin-top: 25px;">Thank you for being with us.</p>

      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;" />

      <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply directly to this email.</p>
    </div>
  `;
};


export interface GenerateAccountUpdatedEmailParams {
  fullName: string;
  updatedFields: string[]; // e.g., ["Email Address", "Password", "Profile Picture"]
  settingsLink: string; // Link to account settings
}

export const generateAccountUpdatedEmail = ({
  fullName,
  updatedFields,
  settingsLink,
}: GenerateAccountUpdatedEmailParams): string => {
  const updatedFieldsList = updatedFields.length > 0
    ? `<p>The following details were updated:</p><ul style="padding-left: 20px;">${updatedFields.map(field => `<li><strong>${field}</strong></li>`).join('')}</ul>`
    : '<p>Some details of your account have been updated.</p>';

  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 600px; margin: auto;">
      <p>Dear ${fullName},</p>

      <p>This is to confirm that your account information has been successfully updated.</p>

      ${updatedFieldsList}

      <p>If you made these changes, you can ignore this email.</p>
      <p>If you did NOT make these changes, please contact our support team immediately to secure your account:</p>

      <p style="text-align: center; margin-top: 25px;">
        <a href="${settingsLink}"
          style="display:inline-block; padding:12px 20px; background:#1a73e8; color:#fff; text-decoration:none; border-radius:4px; font-weight:bold;">
          Review Account Settings
        </a>
      </p>

      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;" />

      <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply directly to this email.</p>
    </div>
  `;
};