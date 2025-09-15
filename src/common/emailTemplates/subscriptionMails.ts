export interface GenerateSubscriptionSuccessEmailParams {
  fullName: string;
  planName: string;
  amount: number;
  publicAccessSettingsLink: string;
  nextBillingDate: string; // formatted date e.g. "Sept 5, 2025"
  transactionRef: string;
}

export const generateSubscriptionReceiptEmail = ({
  fullName,
  planName,
  amount,
  nextBillingDate,
  transactionRef,
  publicAccessSettingsLink,
}: GenerateSubscriptionSuccessEmailParams): string => {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.6; max-width: 650px; margin: auto; border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden;">
      
      <!-- Header -->
      <div style="background: #1a73e8; color: #fff; padding: 20px; text-align: center;">
        <h2 style="margin: 0;">Payment Receipt</h2>
        <p style="margin: 0; font-size: 13px;">Transaction Confirmation</p>
      </div>

      <!-- Body -->
      <div style="padding: 20px;">
        <p>Hi ${fullName},</p>
        <p>Thank you for your payment. Below are the details of your subscription:</p>

        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tbody>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Plan</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${planName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Amount Paid</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">₦${amount.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Transaction Reference</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${transactionRef}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Next Billing Date</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${nextBillingDate}</td>
            </tr>
          </tbody>
        </table>

        <p style="margin-top: 20px;">
          Your account is now <strong>public</strong>. You can access it or share your public profile link:
        </p>
        <p>
          <a href="${publicAccessSettingsLink}" target="_blank" style="color: #1a73e8; text-decoration: none;">
            ${publicAccessSettingsLink}
          </a>
        </p>

        <p style="margin-top: 20px;">We appreciate your continued trust in us.</p>
      </div>

      <!-- Footer -->
      <div style="background: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #777;">
        <p style="margin: 0;">This is an automated receipt. Please do not reply to this email.</p>
      </div>
    </div>
  `;
};



// ----------------- SUBSCRIPTION FAILURE EMAIL -----------------

export interface GenerateSubscriptionFailureEmailParams {
  fullName: string;
  planName: string;
  amount: number;
  transactionRef: string;
  subscriptionPlansLink: string; // link to retry or update payment method
}

export const generateSubscriptionFailureEmail = ({
  fullName,
  planName,
  amount,
  transactionRef,
  subscriptionPlansLink
}: GenerateSubscriptionFailureEmailParams): string => {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 600px; margin: auto;">
      <p>Dear ${fullName},</p>

      <p>Unfortunately, we were unable to process your subscription payment.</p>

      <p><strong>Subscription Attempt:</strong></p>
      <ul style="padding-left: 20px;">
        <li><strong>Plan:</strong> ${planName}</li>
        <li><strong>Amount:</strong> ₦${amount.toLocaleString()}</li>
        <li><strong>Transaction Reference:</strong> ${transactionRef}</li>
      </ul>

      <p>Please select a new subscription plan to continue enjoying premium features.</p>

      <p>
        <a href="${subscriptionPlansLink}" 
          style="display:inline-block; padding:10px 16px; background:#0066cc; color:#fff; text-decoration:none; border-radius:4px;">
          Choose Subscription Plan
        </a>
      </p>

      <p>If you’ve already subscribed to a new plan, kindly ignore this message.</p>

      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;" />


      <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply directly to this email.</p>
    </div>
  `;
};



// ----------------- SUBSCRIPTION CANCELLATION EMAIL -----------------

export interface GenerateSubscriptionCancellationEmailParams {
  fullName: string;
  planName: string;
  amount: number;
  transactionRef: string;
  cancelledDate: string; // e.g., "Sept 5, 2025"
}

export const generateSubscriptionCancellationEmail = ({
  fullName,
  planName,
  amount,
  transactionRef,
  cancelledDate
}: GenerateSubscriptionCancellationEmailParams): string => {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 600px; margin: auto;">
      <p>Dear ${fullName},</p>

      <p>Your subscription has been successfully <strong>cancelled</strong> as of ${cancelledDate}.</p>

      <p><strong>Subscription Details:</strong></p>
      <ul style="padding-left: 20px;">
        <li><strong>Plan:</strong> ${planName}</li>
        <li><strong>Amount Paid:</strong> ₦${amount.toLocaleString()}</li>
        <li><strong>Transaction Reference:</strong> ${transactionRef}</li>
      </ul>

      <p>You will no longer be billed for this subscription. Any remaining access period may still be valid depending on your plan.</p>

      <p>If this cancellation was a mistake or you wish to resubscribe, you can reactivate your subscription at any time.</p>

      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;" />

      <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply directly to this email.</p>
    </div>
  `;
};

// ----------------- AUTO-RENEWAL STOPPED EMAIL -----------------

export interface GenerateAutoRenewalStoppedEmailParams {
  fullName: string;
  planName: string;
  lastBillingDate: string; // e.g., "Sept 5, 2025"
}

export const generateAutoRenewalStoppedEmail = ({
  fullName,
  planName,
  lastBillingDate
}: GenerateAutoRenewalStoppedEmailParams): string => {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 600px; margin: auto;">
      <p>Dear ${fullName},</p>

      <p>The auto-renewal for your subscription <strong>${planName}</strong> has been <strong>stopped</strong> as of ${lastBillingDate}.</p>

      <p>This means your subscription will not automatically renew in the next billing cycle. You will need to manually renew if you wish to continue enjoying premium access.</p>

      <p>If you want to re-enable auto-renewal or update your subscription, you can do so at any time in your account settings.</p>

      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;" />

      <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply directly to this email.</p>
    </div>
  `;
};

// ----------------- SUBSCRIPTION EXPIRED EMAIL -----------------

export interface GenerateSubscriptionExpiredEmailParams {
  fullName: string;
  planName: string;
  expiredDate: string; // formatted date, e.g., "Sept 5, 2025"
  publicAccessLink?: string; // optional, may be empty if access is disabled
}

export const generateSubscriptionExpiredEmail = ({
  fullName,
  planName,
  expiredDate,
  publicAccessLink,
}: GenerateSubscriptionExpiredEmailParams): string => {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 600px; margin: auto;">
      <p>Dear ${fullName},</p>

      <p>We wanted to let you know that your subscription has <strong>expired</strong> as of ${expiredDate}.</p>

      <p><strong>Subscription Details:</strong></p>
      <ul style="padding-left: 20px;">
        <li><strong>Plan:</strong> ${planName}</li>
        <li><strong>Expired Date:</strong> ${expiredDate}</li>
      </ul>

      ${
        publicAccessLink
          ? `<p>Your public access link is still available: <a href="${publicAccessLink}" target="_blank" style="color: #1a73e8;">${publicAccessLink}</a></p>`
          : `<p>Your account is no longer publicly accessible as your subscription has expired.</p>`
      }

      <p>To continue enjoying premium features, please renew your subscription.</p>

      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;" />

      <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply directly to this email.</p>
    </div>
  `;
};


// ----------------- SUBSCRIPTION EXPIRING SOON EMAIL -----------------


export interface GenerateSubscriptionExpiringSoonEmailParams {
  fullName: string;
  planName: string;
  expiryDate: string; // formatted date, e.g., "Sept 5, 2025"
  daysLeft: number; // number of days left before expiry
  publicAccessLink?: string; // optional, for quick access
  autoRenewEnabled: boolean;
}

export const generateSubscriptionExpiringSoonEmail = ({
  fullName,
  planName,
  expiryDate,
  daysLeft,
  publicAccessLink,
  autoRenewEnabled = false,
}: GenerateSubscriptionExpiringSoonEmailParams): string => {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6; max-width: 600px; margin: auto;">
      <p>Dear ${fullName},</p>

      <p>Just a friendly reminder that your subscription is set to <strong>expire in ${daysLeft} day${daysLeft > 1 ? 's' : ''}</strong>, on ${expiryDate}.</p>

      <p><strong>Subscription Details:</strong></p>
      <ul style="padding-left: 20px;">
        <li><strong>Plan:</strong> ${planName}</li>
        <li><strong>Expiry Date:</strong> ${expiryDate}</li>
        <li><strong>Days Remaining:</strong> ${daysLeft}</li>
      </ul>

      ${
        publicAccessLink
          ? `<p>You can continue to enjoy your account and premium features here: <a href="${publicAccessLink}" target="_blank" style="color: #1a73e8;">${publicAccessLink}</a></p>`
          : ''
      }

      ${
        autoRenewEnabled
          ? `<p><strong>Auto-renewal is enabled:</strong> Your account will be automatically charged to renew your subscription before expiry, so you don’t lose access to premium features.</p>`
          : ''
      }

      <p>To avoid interruption of services, please consider renewing your subscription before the expiry date.</p>

      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;" />

      <p style="font-size: 13px; color: #999;">This is an automated message. Please do not reply directly to this email.</p>
    </div>
  `;
};


// ---------------- SUBSCRIPTION AUTO RENEW EMAIL ---------------------

export interface AutoRenewReceiptParams {
  fullName: string;
  planName: string;
  amount: number; // in kobo or naira — adjust formatting
  transactionRef: string;
  nextBillingDate: string; // e.g. "Sep 14, 2025"
  publicAccessSettingsLink: string;
}

export const generateAutoRenewReceiptEmail = ({
  fullName,
  planName,
  amount,
  transactionRef,
  nextBillingDate,
  publicAccessSettingsLink,
}: AutoRenewReceiptParams): { html: string; text: string } => {
  const formattedAmount = `₦${(amount).toLocaleString()}`;

  const html = `
    <p style="font-size:15px;color:#111;margin:0 0 12px;"><strong>Hi ${fullName},</strong></p>
    <p style="margin:0 0 18px;color:#333;line-height:1.45;">
      We’ve successfully renewed your subscription. Below is the receipt for this transaction.
    </p>

    <!-- Receipt card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eef1f6;border-radius:6px;">
      <tr>
        <td style="padding:16px 18px;background:#fafbff;">
          <strong style="font-size:13px;color:#333;">Receipt</strong>
          <div style="float:right;font-size:13px;color:#666;">Ref: <strong style="color:#111;">${transactionRef}</strong></div>
          <div style="clear:both"></div>
        </td>
      </tr>

      <tr>
        <td style="padding:18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#333;">
            <tr>
              <td style="padding:8px 0;border-bottom:1px dashed #eef1f6;"><strong>Plan</strong></td>
              <td style="padding:8px 0;border-bottom:1px dashed #eef1f6;text-align:right;">${planName}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px dashed #eef1f6;"><strong>Amount Paid</strong></td>
              <td style="padding:8px 0;border-bottom:1px dashed #eef1f6;text-align:right;">${formattedAmount}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px dashed #eef1f6;"><strong>Transaction Reference</strong></td>
              <td style="padding:8px 0;border-bottom:1px dashed #eef1f6;text-align:right;">${transactionRef}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;"><strong>Next Billing Date</strong></td>
              <td style="padding:8px 0;text-align:right;">${nextBillingDate}</td>
            </tr>
          </table>

          <!-- CTA -->
          <div style="margin-top:18px;text-align:center;">
            <a href="${publicAccessSettingsLink}" target="_blank" style="display:inline-block;padding:10px 18px;border-radius:6px;text-decoration:none;background:#0b66ff;color:#fff;font-weight:600;font-size:14px;">
              Manage Your Public Profile Settings
            </a>
          </div>

          <p style="margin:16px 0 0;font-size:13px;color:#666;line-height:1.45;">
            If you didn't authorize this charge or need help, contact our support.
          </p>
        </td>
      </tr>
    </table>
  `;

  const text = `
Hi ${fullName},

Your subscription has been renewed successfully.

Receipt
Reference: ${transactionRef}
Plan: ${planName}
Amount Paid: ${formattedAmount}
Next Billing Date: ${nextBillingDate}

Manage your public profile settings: ${publicAccessSettingsLink}

If you didn't authorize this charge or need help, contact out support`;

  return { html, text };
};


